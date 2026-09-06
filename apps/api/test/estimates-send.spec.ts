import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { ContactsService } from "../src/contacts/contacts.service";
import { EstimatesService } from "../src/estimates/estimates.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import type { TemplateBlock } from "../src/templates/template-blocks";
import type { TemplatesService } from "../src/templates/templates.service";

const ESTIMATE_SEND_BLOCKS: TemplateBlock[] = [
	{ kind: "heading", text: "Your estimate is ready" },
	{ kind: "text", html: "Hi {{contact.first_name}}. {{personal_note}}" },
];

const ESTIMATE_ROW = {
	id: "est1",
	title: "Test estimate",
	currency: "USD",
	selectedTier: "BETTER" as const,
	status: "DRAFT" as const,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	contactId: "c1",
	dealId: null,
	drawingId: null,
	createdById: "user1",
	lineItems: [
		{
			name: "Tear-off",
			unit: "PER_EACH",
			quantity: "1",
			areaLabel: null,
			priceGoodCents: 10000,
			priceBetterCents: 12000,
			priceBestCents: 15000,
		},
	],
	contact: {
		firstName: "Jane",
		lastName: "Doe",
		email: "jane@example.com",
		phone: null,
	},
};

function fakeDb() {
	let updateCalled = false;

	const db = {
		estimate: {
			findUnique: async () => ESTIMATE_ROW,
			update: async (args: { data: { status: string } }) => {
				updateCalled = true;
				return { id: ESTIMATE_ROW.id, status: args.data.status };
			},
		},
		organization: {
			findUnique: async () => ({ name: "Acme Roofing" }),
		},
	} as unknown as Db;

	return { db, wasUpdateCalled: () => updateCalled };
}

function fakeMailer(delivered: boolean) {
	let lastSend: {
		subject: string;
		html?: string;
		text?: string;
	} | null = null;

	const mailer = {
		isConfigured: () => true,
		send: async (args: { subject: string; html?: string; text?: string }) => {
			lastSend = args;
			return { delivered };
		},
	} as unknown as MailerService;

	return { mailer, lastSend: () => lastSend };
}

function fakeTemplates(
	subject: string | null = "Your estimate from {{business.name}}",
) {
	return {
		byPurpose: async () => ({
			id: "tmpl-estimate-send",
			subject,
			blocks: ESTIMATE_SEND_BLOCKS,
		}),
	} as unknown as TemplatesService;
}

function fakeMergeContext() {
	let lastRefs: Record<string, unknown> | null = null;

	const service = {
		resolve: async (refs: Record<string, unknown>) => {
			lastRefs = refs;
			return {
				"business.name": "Acme Roofing",
				"contact.first_name": "Jane",
				personal_note:
					typeof refs.personalNote === "string" ? refs.personalNote : "",
			};
		},
	} as unknown as MergeContextService;

	return { service, lastRefs: () => lastRefs };
}

const noContacts = {} as unknown as ContactsService;
const noAgent = {} as unknown as AgentTriggerService;

describe("EstimatesService.send", () => {
	it("throws and never flips status when delivery fails", async () => {
		const { db, wasUpdateCalled } = fakeDb();
		const { mailer } = fakeMailer(false);
		const service = new EstimatesService(
			db,
			noContacts,
			mailer,
			fakeTemplates(),
			fakeMergeContext().service,
			noAgent,
		);

		await expect(service.send({ id: "est1" })).rejects.toBeInstanceOf(
			BadRequestException,
		);

		expect(wasUpdateCalled()).toBe(false);
	});

	it("sets status to SENT when delivery succeeds", async () => {
		const { db } = fakeDb();
		const { mailer } = fakeMailer(true);
		const service = new EstimatesService(
			db,
			noContacts,
			mailer,
			fakeTemplates(),
			fakeMergeContext().service,
			noAgent,
		);

		const result = await service.send({ id: "est1" });

		expect(result.status).toBe("SENT");
	});

	it("renders the subject from the purpose template", async () => {
		const { db } = fakeDb();
		const { mailer, lastSend } = fakeMailer(true);
		const service = new EstimatesService(
			db,
			noContacts,
			mailer,
			fakeTemplates("Your estimate from {{business.name}}"),
			fakeMergeContext().service,
			noAgent,
		);

		await service.send({ id: "est1" });

		expect(lastSend()?.subject).toBe("Your estimate from Acme Roofing");
	});

	it("substitutes the personal note into the rendered email", async () => {
		const { db } = fakeDb();
		const { mailer, lastSend } = fakeMailer(true);
		const service = new EstimatesService(
			db,
			noContacts,
			mailer,
			fakeTemplates(),
			fakeMergeContext().service,
			noAgent,
		);

		await service.send({ id: "est1", personalNote: "See you Tuesday!" });

		expect(lastSend()?.html).toContain("See you Tuesday!");
	});

	it("lets an explicit subject override the template's subject", async () => {
		const { db } = fakeDb();
		const { mailer, lastSend } = fakeMailer(true);
		const service = new EstimatesService(
			db,
			noContacts,
			mailer,
			fakeTemplates("Your estimate from {{business.name}}"),
			fakeMergeContext().service,
			noAgent,
		);

		await service.send({ id: "est1", subject: "Custom subject" });

		expect(lastSend()?.subject).toBe("Custom subject");
	});
});
