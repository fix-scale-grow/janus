import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { FORMS } from "@crm/db/forms";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import type {
	AgentTriggerService,
	CrmEventInput,
} from "../src/agent/agent-trigger.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DealsService } from "../src/deals/deals.service";
import { FieldsService } from "../src/fields/fields.service";
import {
	FORMS_SUBMIT_PER_MINUTE,
	formSubmitWindowKey,
	isFormId,
} from "../src/forms/forms.config";
import { FormsService } from "../src/forms/forms.service";
import { FormsPublicController } from "../src/forms/forms-public.controller";
import { MailerService } from "../src/mailer/mailer.service";
import { MergeContextService } from "../src/templates/merge-context.service";
import { TemplatesService } from "../src/templates/templates.service";
import { TrackingCounterService } from "../src/tracking/tracking-counter.service";
import { TrackingFilingService } from "../src/tracking/tracking-filing.service";
import { withCapturedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "forms-spec";
const keySuffix = suffix.replace(/[^A-Za-z0-9_]/g, "_");
const domain = `forms-${suffix}.test`;
const host = `www.${domain}`;
const userId = `forms-user-${suffix}`;
const memberId = `forms-member-${suffix}`;
const fieldKey = `roof_type_${keySuffix}`;

const capturedEvents: CrmEventInput[] = [];
const contactCreatedCalls: string[] = [];

const agent = {
	contactCreated: async (id: string) => {
		contactCreatedCalls.push(id);
	},
	fieldBackfill: async () => undefined,
	withCrmEvents: withCapturedCrmEvents(capturedEvents),
} as unknown as AgentTriggerService;

const stamp = new ActivityStampService(db);
const conversion = new ConversionService(db);
const fields = new FieldsService(db, agent);
const deals = new DealsService(db, agent, stamp, conversion, fields);
const counters = new TrackingCounterService(db);
const mergeContext = new MergeContextService(db);
const filing = new TrackingFilingService(db, counters, agent, stamp, fields);

let outboxDir: string;
let mailer: MailerService;
let templates: TemplatesService;
let forms: FormsService;

async function clean() {
	await db.activity.deleteMany({ where: { body: { contains: domain } } });
	await db.activity.deleteMany({
		where: { contact: { email: { endsWith: domain } } },
	});
	await db.dealContact.deleteMany({
		where: { contact: { email: { endsWith: domain } } },
	});
	await db.deal.deleteMany({ where: { ownerId: userId } });
	await db.formSubmission.deleteMany({ where: { host: { contains: domain } } });
	await db.fieldValue.deleteMany({
		where: { contact: { email: { endsWith: domain } } },
	});
	await db.form.deleteMany({ where: { createdById: userId } });
	await db.fieldDefinition.deleteMany({
		where: { entity: "CONTACT", key: fieldKey },
	});
	await db.contact.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
	await db.member.deleteMany({ where: { id: memberId } });
	await db.user.deleteMany({ where: { id: userId } });
	await db.trackingCounter.deleteMany({ where: {} });
	await db.template.deleteMany({ where: { purpose: "FORM_NOTIFY" } });
}

beforeAll(async () => {
	await clean();
	outboxDir = await mkdtemp(join(tmpdir(), "forms-outbox-"));

	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: "crm",
			createdAt: new Date(),
		},
		update: {},
	});

	await db.user.create({
		data: { id: userId, name: "Forms Tester", email: `${userId}@example.test` },
	});

	await db.member.create({
		data: {
			id: memberId,
			organizationId: WORKSPACE_ID,
			userId,
			role: "owner",
			createdAt: new Date(),
		},
	});

	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: fieldKey,
			label: `Roof type ${suffix}`,
			type: "TEXT",
			position: 960,
		},
	});
});

afterAll(async () => {
	await clean();
	await rm(outboxDir, { recursive: true, force: true });
});

beforeEach(async () => {
	capturedEvents.length = 0;
	contactCreatedCalls.length = 0;
	await db.trackingCounter.deleteMany({ where: {} });

	mailer = new MailerService({
		transport: "file",
		outboxDir,
		from: "Janus <leads@example.com>",
	});
	templates = new TemplatesService(db, mergeContext, mailer, fields);
	forms = new FormsService(
		db,
		filing,
		counters,
		fields,
		deals,
		templates,
		mailer,
		stamp,
	);
});

async function createForm(name: string) {
	return forms.create(
		{
			name,
			buttonLabel: "Send",
			confirmation: "Thanks!",
			createLead: true,
			fields: [
				{ type: "EMAIL", label: "Email", required: true },
				{
					type: "TEXT",
					label: "Roof type",
					required: false,
					contactFieldKey: fieldKey,
				},
			],
		},
		userId,
	);
}

function fieldId(
	form: Awaited<ReturnType<typeof createForm>>,
	label: string,
): string {
	const field = form.fields.find((row) => row.label === label);
	if (!field) throw new Error(`Missing field ${label}`);
	return field.id;
}

describe("submitting a website form", () => {
	it("becomes a contact with mapped custom fields, a lead, and the contact.created event", async () => {
		const form = await createForm(`Roofer contact ${suffix}`);
		const email = `lead-${suffix}@${domain}`;

		const result = await forms.submit({
			formId: form.id,
			answers: {
				[fieldId(form, "Email")]: email,
				[fieldId(form, "Roof type")]: "Metal",
			},
			honeypot: "",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/contact",
		});

		expect(result).toEqual({ ok: true });

		const contact = await db.contact.findUnique({
			where: { email },
			select: { id: true, source: true },
		});
		expect(contact?.source).toBe("FORM");

		const value = await db.fieldValue.findFirst({
			where: { contactId: contact?.id, field: { key: fieldKey } },
			select: { text: true },
		});
		expect(value?.text).toBe("Metal");

		const created = capturedEvents.find(
			(event) => event.type === "contact.created",
		);
		expect(created?.data).toMatchObject({ via: "form", host, formId: form.id });

		const dealCreated = capturedEvents.find(
			(event) => event.type === "deal.created",
		);
		expect(dealCreated).toBeTruthy();

		const dealContact = await db.dealContact.findFirst({
			where: { contactId: contact?.id },
			select: { dealId: true },
		});
		expect(dealContact).toBeTruthy();

		const submission = await db.formSubmission.findFirst({
			where: { formId: form.id, email },
			select: { dealId: true },
		});
		expect(submission?.dealId).toBe(dealContact?.dealId ?? null);

		const updatedForm = await db.form.findUnique({
			where: { id: form.id },
			select: { submissionCount: true },
		});
		expect(updatedForm?.submissionCount).toBe(1);
	});

	it("attaches an activity to the open deal already created from this form, instead of a new lead", async () => {
		const form = await createForm(`Repeat contact ${suffix}`);
		const email = `repeat-${suffix}@${domain}`;

		await forms.submit({
			formId: form.id,
			answers: { [fieldId(form, "Email")]: email },
			honeypot: "",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/first",
		});

		const contact = await db.contact.findUnique({
			where: { email },
			select: { id: true },
		});
		const firstDealCount = await db.dealContact.count({
			where: { contactId: contact?.id },
		});
		expect(firstDealCount).toBe(1);

		const firstDealContact = await db.dealContact.findFirst({
			where: { contactId: contact?.id },
			select: { dealId: true },
		});

		const result = await forms.submit({
			formId: form.id,
			answers: { [fieldId(form, "Email")]: email },
			honeypot: "",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/second",
		});

		expect(result).toEqual({ ok: true });

		const secondDealCount = await db.dealContact.count({
			where: { contactId: contact?.id },
		});
		expect(secondDealCount).toBe(1);

		const secondSubmission = await db.formSubmission.findFirst({
			where: { formId: form.id, path: "/second" },
			select: { dealId: true },
		});
		expect(secondSubmission?.dealId).toBe(firstDealContact?.dealId ?? null);

		const activities = await db.activity.count({
			where: {
				contactId: contact?.id,
				meta: { path: ["formId"], equals: form.id },
			},
		});
		expect(activities).toBe(2);
	});

	it("passes a skip reason through without creating a lead", async () => {
		const form = await createForm(`Skip contact ${suffix}`);
		const email = `noreply@${domain}`;

		const result = await forms.submit({
			formId: form.id,
			answers: { [fieldId(form, "Email")]: email },
			honeypot: "",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/skip",
		});

		expect(result).toEqual({ ok: true });

		const submission = await db.formSubmission.findFirst({
			where: { formId: form.id },
			select: { skipReason: true, filedAt: true },
		});
		expect(submission?.filedAt).toBeNull();
		expect(submission?.skipReason).toBeTruthy();
	});

	it("stays silent on a honeypot fill and a too-fast submit", async () => {
		const form = await createForm(`Bot contact ${suffix}`);

		const honeypotted = await forms.submit({
			formId: form.id,
			answers: { [fieldId(form, "Email")]: `bot1-${suffix}@${domain}` },
			honeypot: "http://spam.example",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/bot",
		});
		expect(honeypotted).toEqual({ ok: true });

		const tooFast = await forms.submit({
			formId: form.id,
			answers: { [fieldId(form, "Email")]: `bot2-${suffix}@${domain}` },
			honeypot: "",
			renderedAt: Date.now(),
			host,
			path: "/bot",
		});
		expect(tooFast).toEqual({ ok: true });

		const stored = await db.formSubmission.count({
			where: { formId: form.id },
		});
		expect(stored).toBe(0);
	});

	it("refuses once the per-minute submit cap is reached", async () => {
		const form = await createForm(`Rate cap contact ${suffix}`);

		await counters.take(
			formSubmitWindowKey(),
			FORMS_SUBMIT_PER_MINUTE,
			FORMS_SUBMIT_PER_MINUTE,
		);

		const result = await forms.submit({
			formId: form.id,
			answers: { [fieldId(form, "Email")]: `capped-${suffix}@${domain}` },
			honeypot: "",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/capped",
		});

		expect(result.ok).toBe(false);
	});

	it("404s an inactive form", async () => {
		const form = await createForm(`Inactive contact ${suffix}`);
		await forms.setActive(form.id, false);

		let caught: unknown;
		try {
			await forms.submit({
				formId: form.id,
				answers: { [fieldId(form, "Email")]: `inactive-${suffix}@${domain}` },
				honeypot: "",
				renderedAt: Date.now() - 5_000,
				host,
				path: "/inactive",
			});
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(NotFoundException);
	});

	it("emails the notify address with the answers and the brand", async () => {
		const form = await createForm(`Notify contact ${suffix}`);
		const email = `notify-${suffix}@${domain}`;

		await forms.submit({
			formId: form.id,
			answers: {
				[fieldId(form, "Email")]: email,
				[fieldId(form, "Roof type")]: "Shingle",
			},
			honeypot: "",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/notify",
		});

		const entries = await readdir(outboxDir);
		expect(entries.length).toBeGreaterThan(0);

		const latest = entries.sort().at(-1) ?? "";
		const envelopeRaw = await readFile(
			join(outboxDir, latest, "envelope.json"),
			"utf8",
		);
		const envelope = JSON.parse(envelopeRaw) as {
			to: string;
			subject: string;
			html: string | null;
		};

		expect(envelope.to).toBe(`${userId}@example.test`);
		expect(envelope.subject).toContain(form.name);
		expect(envelope.html).toContain("Shingle");
	});

	it("still emails the second notify address when the first send throws", async () => {
		const form = await createForm(`Two recipients ${suffix}`);
		const email = `tworecipients-${suffix}@${domain}`;

		const secondMemberId = `forms-member2-${suffix}`;
		const secondUserId = `forms-user2-${suffix}`;
		const secondEmail = `${secondUserId}@example.test`;
		const badEmail = `${userId}@example.test`;

		await db.user.create({
			data: { id: secondUserId, name: "Second Admin", email: secondEmail },
		});
		await db.member.create({
			data: {
				id: secondMemberId,
				organizationId: WORKSPACE_ID,
				userId: secondUserId,
				role: "admin",
				createdAt: new Date(),
			},
		});

		const sent: string[] = [];
		const stubMailer = {
			isConfigured: () => true,
			send: async ({ to }: { to: string }) => {
				if (to === badEmail) throw new Error("The bad address always fails.");
				sent.push(to);
				return { delivered: true };
			},
		} as unknown as MailerService;

		const stubForms = new FormsService(
			db,
			filing,
			counters,
			fields,
			deals,
			templates,
			stubMailer,
			stamp,
		);

		try {
			const result = await stubForms.submit({
				formId: form.id,
				answers: { [fieldId(form, "Email")]: email },
				honeypot: "",
				renderedAt: Date.now() - 5_000,
				host,
				path: "/two",
			});

			expect(result).toEqual({ ok: true });
			expect(sent).toContain(secondEmail);
		} finally {
			await db.member.deleteMany({ where: { id: secondMemberId } });
			await db.user.deleteMany({ where: { id: secondUserId } });
		}
	});
});

describe("a contact-field mapping never breaks a submission", () => {
	it("degrades an archived contactFieldKey to unmapped instead of failing the submission", async () => {
		const archivedKey = `archived_field_${keySuffix}`;
		const definition = await db.fieldDefinition.create({
			data: {
				entity: "CONTACT",
				key: archivedKey,
				label: `Archived field ${suffix}`,
				type: "TEXT",
				position: 961,
			},
		});

		const form = await forms.create(
			{
				name: `Archived mapping ${suffix}`,
				buttonLabel: "Send",
				confirmation: "Thanks!",
				createLead: true,
				fields: [
					{ type: "EMAIL", label: "Email", required: true },
					{
						type: "TEXT",
						label: "Roof age",
						required: false,
						contactFieldKey: archivedKey,
					},
				],
			},
			userId,
		);

		await db.fieldDefinition.update({
			where: { id: definition.id },
			data: { archivedAt: new Date() },
		});

		const email = `archived-${suffix}@${domain}`;

		try {
			const result = await forms.submit({
				formId: form.id,
				answers: {
					[fieldId(form, "Email")]: email,
					[fieldId(form, "Roof age")]: "20 years",
				},
				honeypot: "",
				renderedAt: Date.now() - 5_000,
				host,
				path: "/archived",
			});

			expect(result).toEqual({ ok: true });

			const contact = await db.contact.findUnique({
				where: { email },
				select: { id: true },
			});
			expect(contact).toBeTruthy();

			const value = await db.fieldValue.findFirst({
				where: { contactId: contact?.id, field: { key: archivedKey } },
			});
			expect(value).toBeNull();
		} finally {
			await db.fieldDefinition.delete({ where: { id: definition.id } });
		}
	});

	it("drops a mapping whose value fails the target field's type coercion, filing everything else", async () => {
		const numberKey = `roof_age_${keySuffix}`;
		const definition = await db.fieldDefinition.create({
			data: {
				entity: "CONTACT",
				key: numberKey,
				label: `Roof age ${suffix}`,
				type: "NUMBER",
				position: 962,
			},
		});

		const form = await forms.create(
			{
				name: `Type mismatch ${suffix}`,
				buttonLabel: "Send",
				confirmation: "Thanks!",
				createLead: true,
				fields: [
					{ type: "EMAIL", label: "Email", required: true },
					{
						type: "TEXT",
						label: "Roof type",
						required: false,
						contactFieldKey: fieldKey,
					},
					{
						type: "TEXT",
						label: "Roof age",
						required: false,
						contactFieldKey: numberKey,
					},
				],
			},
			userId,
		);

		const email = `mismatch-${suffix}@${domain}`;

		try {
			const result = await forms.submit({
				formId: form.id,
				answers: {
					[fieldId(form, "Email")]: email,
					[fieldId(form, "Roof type")]: "Metal",
					[fieldId(form, "Roof age")]: "not a number",
				},
				honeypot: "",
				renderedAt: Date.now() - 5_000,
				host,
				path: "/mismatch",
			});

			expect(result).toEqual({ ok: true });

			const contact = await db.contact.findUnique({
				where: { email },
				select: { id: true },
			});
			expect(contact).toBeTruthy();

			const roofType = await db.fieldValue.findFirst({
				where: { contactId: contact?.id, field: { key: fieldKey } },
				select: { text: true },
			});
			expect(roofType?.text).toBe("Metal");

			const roofAge = await db.fieldValue.findFirst({
				where: { contactId: contact?.id, field: { key: numberKey } },
			});
			expect(roofAge).toBeNull();
		} finally {
			await db.fieldDefinition.delete({ where: { id: definition.id } });
		}
	});

	it("rejects a contactFieldKey that names no live contact field, at save time", async () => {
		let caught: unknown;
		try {
			await forms.create(
				{
					name: `Bad mapping ${suffix}`,
					buttonLabel: "Send",
					confirmation: "Thanks!",
					createLead: true,
					fields: [
						{ type: "EMAIL", label: "Email", required: true },
						{
							type: "TEXT",
							label: "Nonsense",
							required: false,
							contactFieldKey: `nope_${keySuffix}`,
						},
					],
				},
				userId,
			);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
	});

	it("rejects an already-archived contactFieldKey at save time", async () => {
		const archivedKey = `archived_at_save_${keySuffix}`;
		const definition = await db.fieldDefinition.create({
			data: {
				entity: "CONTACT",
				key: archivedKey,
				label: "Archived at save",
				type: "TEXT",
				position: 963,
				archivedAt: new Date(),
			},
		});

		let caught: unknown;
		try {
			await forms.create(
				{
					name: `Archived-at-save mapping ${suffix}`,
					buttonLabel: "Send",
					confirmation: "Thanks!",
					createLead: true,
					fields: [
						{ type: "EMAIL", label: "Email", required: true },
						{
							type: "TEXT",
							label: "Nonsense",
							required: false,
							contactFieldKey: archivedKey,
						},
					],
				},
				userId,
			);
		} catch (error) {
			caught = error;
		} finally {
			await db.fieldDefinition.delete({ where: { id: definition.id } });
		}

		expect(caught).toBeInstanceOf(BadRequestException);
	});
});

describe("two forms on the same page do not swallow each other's submissions", () => {
	it("files a separate submission and a separate lead for each form, same email, same minute", async () => {
		const formA = await createForm(`Form A ${suffix}`);
		const formB = await createForm(`Form B ${suffix}`);
		const email = `dual-${suffix}@${domain}`;
		const renderedAt = Date.now() - 5_000;

		const resultA = await forms.submit({
			formId: formA.id,
			answers: { [fieldId(formA, "Email")]: email },
			honeypot: "",
			renderedAt,
			host,
			path: "/a",
		});
		const resultB = await forms.submit({
			formId: formB.id,
			answers: { [fieldId(formB, "Email")]: email },
			honeypot: "",
			renderedAt,
			host,
			path: "/b",
		});

		expect(resultA).toEqual({ ok: true });
		expect(resultB).toEqual({ ok: true });

		const submissionCount = await db.formSubmission.count({
			where: { email, host },
		});
		expect(submissionCount).toBe(2);

		const contact = await db.contact.findUnique({
			where: { email },
			select: { id: true },
		});
		const dealContactCount = await db.dealContact.count({
			where: { contactId: contact?.id },
		});
		expect(dealContactCount).toBe(2);
	});
});

describe("the notify email keeps answer text out of merge substitution", () => {
	it("does not substitute a token-looking string typed into an answer", async () => {
		const form = await createForm(`Token contact ${suffix}`);
		const email = `token-${suffix}@${domain}`;
		const payload = "Contact {{contact.email}} at {{business.name}} please";

		await forms.submit({
			formId: form.id,
			answers: {
				[fieldId(form, "Email")]: email,
				[fieldId(form, "Roof type")]: payload,
			},
			honeypot: "",
			renderedAt: Date.now() - 5_000,
			host,
			path: "/token",
		});

		const entries = await readdir(outboxDir);
		const latest = entries.sort().at(-1) ?? "";
		const envelopeRaw = await readFile(
			join(outboxDir, latest, "envelope.json"),
			"utf8",
		);
		const envelope = JSON.parse(envelopeRaw) as { html: string | null };

		expect(envelope.html).toContain("&#123;&#123;contact.email&#125;&#125;");
		expect(envelope.html).toContain("&#123;&#123;business.name&#125;&#125;");
	});
});

describe("the public submit endpoint enforces the body cap on a pre-parsed body", () => {
	it("rejects a pre-parsed body over the cap", async () => {
		const stubForms = {
			submit: async () => ({ ok: true }),
		} as unknown as FormsService;
		const controller = new FormsPublicController(stubForms);
		const fakeResponse = { setHeader: () => undefined } as unknown as Response;
		const big = "x".repeat(FORMS.submit.maxBodyBytes);
		const fakeRequest = {
			body: { answers: { a: big } },
		} as unknown as IncomingMessage;

		const result = await controller.submit(fakeRequest, fakeResponse);

		expect(result).toEqual({
			ok: false,
			errors: { _form: "The submission was too large." },
		});
	});

	it("accepts a pre-parsed body under the cap", async () => {
		let received: unknown;
		const stubForms = {
			submit: async (input: unknown) => {
				received = input;
				return { ok: true };
			},
		} as unknown as FormsService;
		const controller = new FormsPublicController(stubForms);
		const fakeResponse = { setHeader: () => undefined } as unknown as Response;

		const body = {
			formId: "cabcdefghij0123456789",
			answers: { a: "x".repeat(2000) },
			honeypot: "",
			renderedAt: Date.now(),
			host: "example.test",
			path: "/",
		};
		expect(JSON.stringify(body).length).toBeLessThan(FORMS.submit.maxBodyBytes);

		const fakeRequest = { body } as unknown as IncomingMessage;
		const result = await controller.submit(fakeRequest, fakeResponse);

		expect(result).toEqual({ ok: true });
		expect(received).toMatchObject({ formId: body.formId });
	});
});

describe("the public form id guard", () => {
	it("rejects a garbage id without touching the database", async () => {
		let dbTouched = false;
		const stubForms = {
			publicConfig: async () => {
				dbTouched = true;
				return null;
			},
		} as unknown as FormsService;
		const controller = new FormsPublicController(stubForms);
		const fakeResponse = { setHeader: () => undefined } as unknown as Response;

		const result = await controller.config("../../etc/passwd", fakeResponse);

		expect(result).toEqual({ config: null });
		expect(dbTouched).toBe(false);
	});

	it("still reaches the service for a well-shaped id", async () => {
		let dbTouched = false;
		const stubForms = {
			publicConfig: async () => {
				dbTouched = true;
				return null;
			},
		} as unknown as FormsService;
		const controller = new FormsPublicController(stubForms);
		const fakeResponse = { setHeader: () => undefined } as unknown as Response;

		await controller.config("cabcdefghij0123456789", fakeResponse);

		expect(dbTouched).toBe(true);
	});

	it("classifies id shapes the same way the controller does", () => {
		expect(isFormId("../../etc/passwd")).toBe(false);
		expect(isFormId("' OR 1=1--")).toBe(false);
		expect(isFormId("cabcdefghij0123456789")).toBe(true);
	});
});

describe("the tracking path through the extended filing service", () => {
	it("behaves as before and now emits contact.created without a formId", async () => {
		const email = `tracker-${suffix}@${domain}`;
		const submission = await db.formSubmission.create({
			data: {
				host,
				path: "/pricing",
				email,
				fields: { email },
				dedupeKey: `${suffix}-tracker-${Math.random().toString(36).slice(2)}`,
			},
			select: { id: true },
		});

		const outcome = await filing.file({
			id: submission.id,
			email,
			host,
			visitorId: `visitor-${Math.random().toString(36).slice(2, 12)}`,
			name: "Tracker Person",
		});

		expect(outcome.filed).toBe(true);

		const contact = await db.contact.findUnique({
			where: { email },
			select: { source: true },
		});
		expect(contact?.source).toBe("TRACKING");

		const created = capturedEvents.find(
			(event) => event.type === "contact.created",
		);
		expect(created?.data).toMatchObject({ via: "tracking", host });
		expect((created?.data as { formId?: string })?.formId).toBeUndefined();
	});
});
