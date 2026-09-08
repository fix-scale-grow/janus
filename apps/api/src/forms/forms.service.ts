import { WORKSPACE_ID } from "@crm/auth";
import {
	ActivityType,
	type Db,
	type FormFieldType,
	Prisma,
	RecordSource,
	StageOutcome,
	TemplatePurpose,
} from "@crm/db";
import { classifyTouch, type RawTouch, type Touch } from "@crm/db/attribution";
import {
	FORMS,
	type FormSubmissionAnswer,
	formSubmissionAnswers,
	type PublicFormConfig,
} from "@crm/db/forms";
import { dedupeKey, normalizeHost, normalizePath } from "@crm/db/tracking";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { normalizeEmail } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { DealsService } from "../deals/deals.service";
import { FieldsService } from "../fields/fields.service";
import { MailerService } from "../mailer/mailer.service";
import {
	applyMergeFields,
	renderEmailHtml,
	resolveEmailBrand,
} from "../templates/render-email";
import {
	parseTemplateBlocks,
	type TemplateBlocks,
} from "../templates/template-blocks";
import { TemplatesService } from "../templates/templates.service";
import { TrackingCounterService } from "../tracking/tracking-counter.service";
import { TrackingFilingService } from "../tracking/tracking-filing.service";
import type { ListInput } from "../trpc/list-input";
import { paginate, resolveOrderBy } from "../trpc/list-input";
import {
	FORMS_SUBMIT_PER_MINUTE,
	formSubmitWindowKey,
	NOTIFY_ROLES,
	RATE_LIMITED_REASON,
} from "./forms.config";
import type {
	FormCreateInput,
	FormFieldInput,
	FormSubmissionsInput,
	FormSubmitInput,
	FormSubmitResult,
	FormUpdateFieldsInput,
	FormUpdateInput,
} from "./forms.contracts";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_SHAPE = /^[0-9()+\-.\s]{7,20}$/;

const FIELD_SELECT = {
	fields: { orderBy: { position: "asc" as const } },
} satisfies Prisma.FormInclude;

@Injectable()
export class FormsService {
	private readonly logger = new Logger(FormsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly filing: TrackingFilingService,
		private readonly counters: TrackingCounterService,
		private readonly fields: FieldsService,
		private readonly deals: DealsService,
		private readonly templates: TemplatesService,
		private readonly mailer: MailerService,
		private readonly stamp: ActivityStampService,
	) {}

	async list(input: ListInput) {
		const where: Prisma.FormWhereInput = input.q
			? { name: { contains: input.q, mode: "insensitive" } }
			: {};

		const orderBy = resolveOrderBy<Prisma.FormOrderByWithRelationInput>(
			input,
			{
				name: (dir) => ({ name: dir }),
				updatedAt: (dir) => ({ updatedAt: dir }),
				submissionCount: (dir) => ({ submissionCount: dir }),
			},
			{ updatedAt: "desc" },
		);

		const [rows, total] = await Promise.all([
			this.db.form.findMany({
				where,
				orderBy,
				...paginate(input),
			}),
			this.db.form.count({ where }),
		]);

		return { rows, total, facetCounts: {} };
	}

	async byId(id: string) {
		const form = await this.db.form.findUnique({
			where: { id },
			include: FIELD_SELECT,
		});

		if (!form) throw new NotFoundException(`No form with id ${id}.`);

		return form;
	}

	async create(input: FormCreateInput, userId: string) {
		requireExactlyOneEmailField(input.fields);

		return this.db.form.create({
			data: {
				name: input.name.trim(),
				intro: input.intro ?? null,
				buttonLabel: input.buttonLabel,
				confirmation: input.confirmation,
				createLead: input.createLead,
				notifyEmails: input.notifyEmails ?? null,
				createdById: userId,
				fields: {
					create: input.fields.map((field, position) => ({
						type: field.type,
						label: field.label,
						required: field.required,
						options: field.options ?? Prisma.JsonNull,
						contactFieldKey: field.contactFieldKey ?? null,
						position,
					})),
				},
			},
			include: FIELD_SELECT,
		});
	}

	async update(id: string, data: FormUpdateInput) {
		try {
			return await this.db.form.update({
				where: { id },
				data: {
					...(data.name !== undefined ? { name: data.name.trim() } : {}),
					...(data.intro !== undefined ? { intro: data.intro } : {}),
					...(data.buttonLabel !== undefined
						? { buttonLabel: data.buttonLabel }
						: {}),
					...(data.confirmation !== undefined
						? { confirmation: data.confirmation }
						: {}),
					...(data.createLead !== undefined
						? { createLead: data.createLead }
						: {}),
					...(data.notifyEmails !== undefined
						? { notifyEmails: data.notifyEmails }
						: {}),
				},
				include: FIELD_SELECT,
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No form with id ${id}.`);
			}
			throw error;
		}
	}

	async updateFields(input: FormUpdateFieldsInput) {
		requireExactlyOneEmailField(input.fields);

		const form = await this.db.form.findUnique({
			where: { id: input.formId },
			select: { id: true },
		});
		if (!form) throw new NotFoundException(`No form with id ${input.formId}.`);

		const existing = await this.db.formField.findMany({
			where: { formId: input.formId },
			select: { id: true },
		});
		const existingIds = new Set(existing.map((row) => row.id));
		const incomingIds = new Set(
			input.fields.flatMap((field) => (field.id ? [field.id] : [])),
		);

		for (const id of incomingIds) {
			if (!existingIds.has(id)) {
				throw new BadRequestException(
					"That field is not on this form anymore.",
				);
			}
		}

		const removedIds = [...existingIds].filter((id) => !incomingIds.has(id));

		await this.db.$transaction([
			...(removedIds.length > 0
				? [this.db.formField.deleteMany({ where: { id: { in: removedIds } } })]
				: []),
			...input.fields.map((field, position) =>
				field.id
					? this.db.formField.update({
							where: { id: field.id },
							data: {
								type: field.type,
								label: field.label,
								required: field.required,
								options: field.options ?? Prisma.JsonNull,
								contactFieldKey: field.contactFieldKey ?? null,
								position,
							},
						})
					: this.db.formField.create({
							data: {
								formId: input.formId,
								type: field.type,
								label: field.label,
								required: field.required,
								options: field.options ?? Prisma.JsonNull,
								contactFieldKey: field.contactFieldKey ?? null,
								position,
							},
						}),
			),
		]);

		return this.byId(input.formId);
	}

	async setActive(id: string, active: boolean) {
		try {
			return await this.db.form.update({
				where: { id },
				data: { active },
				include: FIELD_SELECT,
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No form with id ${id}.`);
			}
			throw error;
		}
	}

	async remove(id: string) {
		const submissions = await this.db.formSubmission.count({
			where: { formId: id },
		});

		if (submissions > 0) {
			throw new BadRequestException(
				"This form has submissions — it can be turned off instead of removed.",
			);
		}

		try {
			await this.db.form.delete({ where: { id } });
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`No form with id ${id}.`);
			}
			throw error;
		}

		return { id };
	}

	async submissions(input: FormSubmissionsInput) {
		const { formId, listInput: list } = input;

		const [rows, total] = await Promise.all([
			this.db.formSubmission.findMany({
				where: { formId },
				orderBy: { createdAt: "desc" },
				...paginate(list),
				select: {
					id: true,
					fields: true,
					email: true,
					contactId: true,
					filedAt: true,
					skipReason: true,
					createdAt: true,
				},
			}),
			this.db.formSubmission.count({ where: { formId } }),
		]);

		return { rows, total, facetCounts: {} };
	}

	async publicConfig(formId: string): Promise<PublicFormConfig | null> {
		const form = await this.db.form.findUnique({
			where: { id: formId },
			include: FIELD_SELECT,
		});

		if (!form?.active) return null;

		const organization = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { brandColor: true },
		});

		return {
			id: form.id,
			name: form.name,
			intro: form.intro,
			buttonLabel: form.buttonLabel,
			confirmation: form.confirmation,
			brandColor: organization?.brandColor ?? null,
			fields: form.fields.map((field) => ({
				id: field.id,
				type: field.type,
				label: field.label,
				required: field.required,
				options: (field.options as string[] | null) ?? undefined,
			})),
		};
	}

	async submit(input: FormSubmitInput): Promise<FormSubmitResult> {
		const form = await this.db.form.findUnique({
			where: { id: input.formId },
			include: FIELD_SELECT,
		});

		if (!form?.active) {
			throw new NotFoundException("No active form with that id.");
		}

		if (input.honeypot.length > 0) return { ok: true };

		const elapsedSeconds = (Date.now() - input.renderedAt) / 1000;
		if (
			!Number.isFinite(elapsedSeconds) ||
			elapsedSeconds < FORMS.submit.minSeconds
		) {
			return { ok: true };
		}

		const withinRate = await this.counters.take(
			formSubmitWindowKey(),
			FORMS_SUBMIT_PER_MINUTE,
		);
		if (!withinRate) {
			return { ok: false, errors: { _form: RATE_LIMITED_REASON } };
		}

		const validated = this.validate(form.fields, input.answers);
		if ("errors" in validated) return { ok: false, errors: validated.errors };

		const { answers, email, contactFields, name } = validated;

		const host = normalizeHost(input.host) ?? input.host.toLowerCase().trim();
		const path = normalizePath(input.path);
		const now = new Date();
		const key = dedupeKey({ host, path, email, at: now });

		const firstTouch = input.firstTouch
			? classifyTouch(arriving(input.firstTouch), now)
			: undefined;
		const lastTouch = input.touch
			? classifyTouch(arriving(input.touch), now)
			: firstTouch;

		const created = await this.db.formSubmission.createMany({
			data: [
				{
					formId: form.id,
					visitorId: input.visitorId ?? null,
					host,
					path,
					email,
					fields: answers as unknown as Prisma.InputJsonValue,
					firstTouch: firstTouch ? touchColumns(firstTouch) : undefined,
					lastTouch: lastTouch ? touchColumns(lastTouch) : undefined,
					dedupeKey: key,
				},
			],
			skipDuplicates: true,
		});

		const submission = await this.db.formSubmission.findUnique({
			where: { dedupeKey: key },
			select: { id: true, filedAt: true, skipReason: true },
		});

		if (!submission) return { ok: true };

		if (created.count > 0 || unfiled(submission)) {
			const outcome = await this.filing.file(
				{
					id: submission.id,
					email,
					host,
					visitorId: input.visitorId ?? null,
					name,
					firstTouch,
					lastTouch,
				},
				{
					formId: form.id,
					source: RecordSource.FORM,
					contactFields,
				},
			);

			if (outcome.filed) {
				if (form.createLead) {
					await this.leadOrAttach(form, outcome.contactId, answers).catch(
						(error: unknown) => {
							this.logger.error(
								{ message: "Could not create or attach the lead" },
								error instanceof Error ? error.stack : String(error),
							);
						},
					);
				}

				await this.notify(form, outcome.contactId, answers).catch(
					(error: unknown) => {
						this.logger.error(
							{ message: "Could not send the form notification" },
							error instanceof Error ? error.stack : String(error),
						);
					},
				);
			}
		}

		if (created.count > 0) {
			await this.db.form.update({
				where: { id: form.id },
				data: { submissionCount: { increment: 1 } },
			});
		}

		return { ok: true };
	}

	private validate(
		formFields: {
			id: string;
			type: FormFieldType;
			label: string;
			required: boolean;
			options: unknown;
			contactFieldKey: string | null;
		}[],
		raw: Record<string, string>,
	):
		| { errors: Record<string, string> }
		| {
				answers: FormSubmissionAnswer[];
				email: string | null;
				contactFields: Record<string, string>;
				name: string | null;
		  } {
		const errors: Record<string, string> = {};
		const answers: FormSubmissionAnswer[] = [];
		const contactFields: Record<string, string> = {};
		let email: string | null = null;
		let name: string | null = null;

		for (const field of formFields) {
			const value = (raw[field.id] ?? "").trim();

			if (field.required && value.length === 0) {
				errors[field.id] = `${field.label} is required.`;
				continue;
			}

			if (value.length === 0) continue;

			if (field.type === "EMAIL" && !EMAIL_SHAPE.test(value)) {
				errors[field.id] = "That doesn't look like an email address.";
				continue;
			}

			if (field.type === "PHONE" && !PHONE_SHAPE.test(value)) {
				errors[field.id] = "That doesn't look like a phone number.";
				continue;
			}

			if (field.type === "SELECT") {
				const options = Array.isArray(field.options)
					? (field.options as string[])
					: [];
				if (!options.includes(value)) {
					errors[field.id] = "Choose one of the listed options.";
					continue;
				}
			}

			answers.push({ fieldId: field.id, label: field.label, value });

			if (field.type === "EMAIL") email = normalizeEmail(value);
			if (field.contactFieldKey) contactFields[field.contactFieldKey] = value;
			if (!name && /name/i.test(field.label)) name = value;
		}

		if (Object.keys(errors).length > 0) return { errors };

		return {
			answers: formSubmissionAnswers.parse(answers),
			email,
			contactFields,
			name,
		};
	}

	private async leadOrAttach(
		form: { id: string; name: string },
		contactId: string,
		answers: FormSubmissionAnswer[],
	): Promise<void> {
		const windowStart = new Date(
			Date.now() - FORMS.dedupeLeadWindowDays * 86_400_000,
		);

		const duplicate = await this.db.dealContact.findFirst({
			where: {
				contactId,
				deal: {
					createdAt: { gte: windowStart },
					stage: { outcome: StageOutcome.OPEN },
					activities: {
						some: {
							AND: [
								{ meta: { path: ["source"], equals: "form" } },
								{ meta: { path: ["formId"], equals: form.id } },
							],
						},
					},
				},
			},
			select: { dealId: true },
			orderBy: { deal: { createdAt: "desc" } },
		});

		const body = answersBody(answers);
		const ownerId = await this.author(contactId);
		if (!ownerId) return;
		const now = new Date();

		if (duplicate) {
			const activity = await this.db.activity.create({
				data: {
					type: ActivityType.NOTE,
					subject: `Resubmitted the ${form.name} form`,
					body,
					contactId,
					dealId: duplicate.dealId,
					occurredAt: now,
					createdById: ownerId,
					meta: { source: "form", formId: form.id },
				},
				select: { createdAt: true },
			});
			await this.stamp.touch(
				{ contactId, dealId: duplicate.dealId },
				activity.createdAt,
			);
			return;
		}

		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { firstName: true, lastName: true },
		});
		const contactName = [contact?.firstName, contact?.lastName]
			.filter(Boolean)
			.join(" ");

		const deal = await this.deals.create({
			name: contactName ? `${form.name} — ${contactName}` : form.name,
			ownerId,
		});

		await this.deals.attachContact({ dealId: deal.id, contactId });

		const activity = await this.db.activity.create({
			data: {
				type: ActivityType.NOTE,
				subject: `New lead from the ${form.name} form`,
				body,
				contactId,
				dealId: deal.id,
				occurredAt: now,
				createdById: ownerId,
				meta: { source: "form", formId: form.id },
			},
			select: { createdAt: true },
		});

		await this.stamp.touch({ contactId, dealId: deal.id }, activity.createdAt);
	}

	private async notify(
		form: { id: string; name: string; notifyEmails: string | null },
		contactId: string,
		answers: FormSubmissionAnswer[],
	): Promise<void> {
		if (!this.mailer.isConfigured()) return;

		const addresses = await this.notifyAddresses(form);
		if (addresses.length === 0) return;

		const template = await this.templates.byPurpose({
			purpose: TemplatePurpose.FORM_NOTIFY,
		});
		const blocks = parseTemplateBlocks(template.blocks);

		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { firstName: true, lastName: true, email: true },
		});

		const organization = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { name: true },
		});

		const context: Record<string, string> = {
			"business.name": organization?.name ?? "",
			"form.name": form.name,
			"contact.full_name": contact
				? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
				: "",
			"contact.first_name": contact?.firstName ?? "",
			"contact.email": contact?.email ?? "",
		};

		for (const answer of answers) {
			context[`form.field.${answer.fieldId}`] = answer.value;
		}

		const subject = template.subject
			? applyMergeFields(template.subject, context)
			: `New lead from ${form.name}`;

		const brand = await resolveEmailBrand(this.db);
		const answerBlocks: TemplateBlocks = answers.flatMap((answer) => [
			{ kind: "heading", text: answer.label },
			{ kind: "text", html: escapeAnswer(answer.value) },
		]);

		const { html, text } = renderEmailHtml(
			[...blocks, ...answerBlocks],
			context,
			"email",
			brand,
		);

		for (const to of addresses) {
			await this.mailer.send({ to, subject, html, text });
		}
	}

	private async notifyAddresses(form: {
		notifyEmails: string | null;
	}): Promise<string[]> {
		if (form.notifyEmails) {
			return [
				...new Set(
					form.notifyEmails
						.split(",")
						.map((address) => address.trim())
						.filter(Boolean),
				),
			];
		}

		const members = await this.db.member.findMany({
			where: {
				organizationId: WORKSPACE_ID,
				role: { in: [...NOTIFY_ROLES] },
			},
			select: { user: { select: { email: true } } },
		});

		return [
			...new Set(
				members
					.map((member) => member.user.email)
					.filter((email): email is string => Boolean(email)),
			),
		];
	}

	private async author(contactId: string): Promise<string | null> {
		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { ownerId: true },
		});

		if (contact?.ownerId) return contact.ownerId;

		const anyUser = await this.db.user.findFirst({ select: { id: true } });

		return anyUser?.id ?? null;
	}
}

function requireExactlyOneEmailField(fields: FormFieldInput[]): void {
	const emailFields = fields.filter((field) => field.type === "EMAIL");

	if (emailFields.length !== 1) {
		throw new BadRequestException(
			"A form needs exactly one email field — it's the dedupe key.",
		);
	}
}

function unfiled(submission: {
	filedAt: Date | null;
	skipReason: string | null;
}): boolean {
	return submission.filedAt === null && submission.skipReason === null;
}

function arriving(touch: RawTouch): RawTouch {
	return {
		...touch,
		referrer: touch.referrer,
		landing: touch.landing,
	};
}

function touchColumns(touch: Touch): Record<string, string | null> {
	return {
		source: touch.source,
		medium: touch.medium,
		campaign: touch.campaign,
		term: touch.term,
		content: touch.content,
		referrer: touch.referrer,
		landing: touch.landing,
	};
}

function answersBody(answers: FormSubmissionAnswer[]): string {
	return answers.map((answer) => `${answer.label}: ${answer.value}`).join("\n");
}

function escapeAnswer(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}
