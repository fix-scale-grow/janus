import type { Db } from "@crm/db";
import { Prisma as PrismaNamespace } from "@crm/db";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import { MailerService } from "../mailer/mailer.service";
import { MergeContextService } from "./merge-context.service";
import { collectTokens, missingMerges } from "./merge-guard";
import { applyMergeFields, renderEmailHtml } from "./render-email";
import { parseTemplateBlocks } from "./template-blocks";
import {
	DEFAULT_TEMPLATES,
	SAMPLE_MERGE_CONTEXT,
	STATIC_MERGE_FIELD_GROUPS,
} from "./templates.config";
import type {
	TemplateByPurposeInput,
	TemplatePreviewInput,
	TemplateSendTestInput,
	TemplateUpdateInput,
} from "./templates.contracts";

const TEST_SUBJECT_PREFIX = "[Test] ";

const LIST_SELECT = {
	id: true,
	name: true,
	type: true,
	purpose: true,
	updatedAt: true,
} as const;

@Injectable()
export class TemplatesService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly mergeContext: MergeContextService,
		private readonly mailer: MailerService,
		private readonly fields: FieldsService,
	) {}

	async list() {
		return this.db.template.findMany({ select: LIST_SELECT });
	}

	async mergeFields() {
		const [contactFields, dealFields] = await Promise.all([
			this.fields.definitionsFor("CONTACT"),
			this.fields.definitionsFor("DEAL"),
		]);

		return {
			groups: [
				...STATIC_MERGE_FIELD_GROUPS,
				{
					id: "contact_fields",
					label: "Contact fields",
					fields: contactFields.map((definition) => ({
						token: `contact.field.${definition.key}`,
						label: definition.label,
					})),
				},
				{
					id: "deal_fields",
					label: "Job fields",
					fields: dealFields.map((definition) => ({
						token: `deal.field.${definition.key}`,
						label: definition.label,
					})),
				},
			],
		};
	}

	async mergeRegistry(): Promise<Map<string, string>> {
		const { groups } = await this.mergeFields();
		const registry = new Map<string, string>();

		for (const group of groups) {
			for (const field of group.fields) {
				registry.set(field.token, field.label);
			}
		}

		registry.set("business.phone", "Business phone");

		return registry;
	}

	async byPurpose(input: TemplateByPurposeInput) {
		const defaults = DEFAULT_TEMPLATES[input.purpose];

		try {
			return await this.db.template.upsert({
				where: { purpose: input.purpose },
				create: {
					purpose: input.purpose,
					type: defaults.type,
					name: defaults.name,
					subject: defaults.subject,
					blocks: defaults.blocks,
				},
				update: {},
			});
		} catch (error) {
			throw this.translate(error);
		}
	}

	async update(input: TemplateUpdateInput, userId: string) {
		const blocks = parseTemplateBlocks(input.blocks);
		const defaults = DEFAULT_TEMPLATES[input.purpose];

		try {
			return await this.db.template.upsert({
				where: { purpose: input.purpose },
				create: {
					purpose: input.purpose,
					type: defaults.type,
					name: input.name,
					subject: input.subject ?? null,
					blocks,
					updatedById: userId,
				},
				update: {
					name: input.name,
					subject: input.subject ?? null,
					blocks,
					updatedById: userId,
				},
			});
		} catch (error) {
			throw this.translate(error);
		}
	}

	async preview(input: TemplatePreviewInput, senderName?: string) {
		const hasRefs = Boolean(
			input.contactId || input.dealId || input.estimateId || input.invoiceId,
		);

		const context = hasRefs
			? await this.mergeContext.resolve({
					contactId: input.contactId,
					dealId: input.dealId,
					estimateId: input.estimateId,
					invoiceId: input.invoiceId,
					senderName,
				})
			: SAMPLE_MERGE_CONTEXT;

		const template = await this.byPurpose({ purpose: input.purpose });
		const blocks = parseTemplateBlocks(template.blocks);

		const subject = template.subject
			? applyMergeFields(template.subject, context)
			: "";
		const mode = input.purpose === "CONTRACT_BODY" ? "document" : "email";
		const { html } = renderEmailHtml(blocks, context, mode);

		const registry = await this.mergeRegistry();
		const tokens = collectTokens(template.subject ?? "", blocks);
		const missing = missingMerges(tokens, context, registry).filter((entry) => {
			if (entry.token === "signing_link") return false;
			if (entry.token === "sender.name" && senderName) return false;
			return true;
		});

		return { subject, html, missing };
	}

	async sendTest(input: TemplateSendTestInput) {
		if (!this.mailer.isConfigured()) {
			throw new BadRequestException("Email is not configured on this install.");
		}

		const template = await this.byPurpose({ purpose: input.purpose });
		const blocks = parseTemplateBlocks(template.blocks);

		const registry = await this.mergeRegistry();
		const tokens = collectTokens(template.subject ?? "", blocks);

		const sampleContext: Record<string, string> = { ...SAMPLE_MERGE_CONTEXT };
		for (const token of tokens) {
			if (sampleContext[token] !== undefined) continue;
			const label = registry.get(token);
			if (label !== undefined) sampleContext[token] = label;
		}

		const missing = missingMerges(tokens, sampleContext, registry);
		const unknownLabels = missing
			.filter((entry) => entry.reason === "unknown")
			.map((entry) => entry.label);

		if (unknownLabels.length > 0) {
			throw new BadRequestException(
				`No longer exists — remove from the template: ${unknownLabels.join(", ")}`,
			);
		}

		const subject = template.subject
			? applyMergeFields(template.subject, sampleContext)
			: "";
		const { html, text } = renderEmailHtml(blocks, sampleContext);

		const result = await this.mailer.send({
			to: input.to,
			subject: `${TEST_SUBJECT_PREFIX}${subject}`,
			text,
			html,
		});

		if (!result.delivered) {
			throw new BadRequestException(
				"The email could not be sent. Check the mail configuration and try again.",
			);
		}

		return { delivered: true };
	}

	mailerConfigured(): boolean {
		return this.mailer.isConfigured();
	}

	private translate(error: unknown): unknown {
		if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (error.code === "P2003") {
				return new BadRequestException("That record no longer exists.");
			}
		}
		return error;
	}
}
