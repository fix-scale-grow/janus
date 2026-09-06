import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import { InvoicesService } from "../src/invoices/invoices.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import type { TemplateBlock } from "../src/templates/template-blocks";
import type { TemplatesService } from "../src/templates/templates.service";

const INVOICE_SEND_BLOCKS: TemplateBlock[] = [
	{ kind: "heading", text: "Your invoice is ready" },
	{ kind: "text", html: "Hi {{contact.first_name}}. {{personal_note}}" },
];

function invoiceRow(issuedAt: Date | null) {
	return {
		id: "inv1",
		number: 42,
		currency: "USD",
		status: "DRAFT" as const,
		issuedAt,
		dueAt: new Date("2026-02-14T00:00:00Z"),
		paidAt: null,
		notes: null,
		contactId: "c1",
		dealId: null,
		estimateId: null,
		createdById: "user1",
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		lineItems: [
			{
				name: "Tear-off",
				unit: "PER_EACH",
				quantity: "1",
				areaLabel: null,
				priceCents: 10000,
			},
		],
		contact: {
			firstName: "Jane",
			lastName: "Doe",
			email: "jane@example.com",
			phone: null,
		},
	};
}

function fakeDb(issuedAt: Date | null) {
	let updateData: { status: string; issuedAt?: Date } | null = null;

	const db = {
		invoice: {
			findUnique: async () => invoiceRow(issuedAt),
			update: async (args: { data: { status: string; issuedAt?: Date } }) => {
				updateData = args.data;
				return {
					id: "inv1",
					status: args.data.status,
					issuedAt: args.data.issuedAt ?? issuedAt,
				};
			},
		},
		organization: {
			findUnique: async () => ({ name: "Acme Roofing" }),
		},
	} as unknown as Db;

	return { db, updateData: () => updateData };
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
	subject: string | null = "Your invoice from {{business.name}}",
) {
	return {
		byPurpose: async () => ({
			id: "tmpl-invoice-send",
			subject,
			blocks: INVOICE_SEND_BLOCKS,
		}),
		mergeRegistry: async () =>
			new Map([
				["business.name", "Business name"],
				["contact.first_name", "First name"],
				["personal_note", "Personal note"],
			]),
	} as unknown as TemplatesService;
}

function fakeMergeContext() {
	return {
		resolve: async (refs: Record<string, unknown>) => ({
			"business.name": "Acme Roofing",
			"contact.first_name": "Jane",
			personal_note:
				typeof refs.personalNote === "string" ? refs.personalNote : "",
		}),
	} as unknown as MergeContextService;
}

describe("InvoicesService.send", () => {
	it("throws and never flips status when delivery fails", async () => {
		const { db, updateData } = fakeDb(null);
		const { mailer } = fakeMailer(false);
		const service = new InvoicesService(
			db,
			mailer,
			fakeTemplates(),
			fakeMergeContext(),
		);

		await expect(service.send({ id: "inv1" })).rejects.toBeInstanceOf(
			BadRequestException,
		);

		expect(updateData()).toBeNull();
	});

	it("sets status to SENT and stamps issuedAt when delivery succeeds", async () => {
		const { db } = fakeDb(null);
		const { mailer } = fakeMailer(true);
		const service = new InvoicesService(
			db,
			mailer,
			fakeTemplates(),
			fakeMergeContext(),
		);

		const result = await service.send({ id: "inv1" });

		expect(result.status).toBe("SENT");
		expect(result.issuedAt).toBeInstanceOf(Date);
	});

	it("does not overwrite issuedAt when already set", async () => {
		const existingIssuedAt = new Date("2026-01-05T00:00:00Z");
		const { db, updateData } = fakeDb(existingIssuedAt);
		const { mailer } = fakeMailer(true);
		const service = new InvoicesService(
			db,
			mailer,
			fakeTemplates(),
			fakeMergeContext(),
		);

		const result = await service.send({ id: "inv1" });

		expect(result.issuedAt).toEqual(existingIssuedAt);
		expect(updateData()?.issuedAt).toEqual(existingIssuedAt);
	});

	it("renders the subject from the purpose template", async () => {
		const { db } = fakeDb(null);
		const { mailer, lastSend } = fakeMailer(true);
		const service = new InvoicesService(
			db,
			mailer,
			fakeTemplates("Your invoice from {{business.name}}"),
			fakeMergeContext(),
		);

		await service.send({ id: "inv1" });

		expect(lastSend()?.subject).toBe("Your invoice from Acme Roofing");
	});

	it("substitutes the personal note into the rendered email", async () => {
		const { db } = fakeDb(null);
		const { mailer, lastSend } = fakeMailer(true);
		const service = new InvoicesService(
			db,
			mailer,
			fakeTemplates(),
			fakeMergeContext(),
		);

		await service.send({ id: "inv1", personalNote: "Thanks again!" });

		expect(lastSend()?.html).toContain("Thanks again!");
	});

	it("lets an explicit subject override the template's subject", async () => {
		const { db } = fakeDb(null);
		const { mailer, lastSend } = fakeMailer(true);
		const service = new InvoicesService(
			db,
			mailer,
			fakeTemplates("Your invoice from {{business.name}}"),
			fakeMergeContext(),
		);

		await service.send({ id: "inv1", subject: "Custom subject" });

		expect(lastSend()?.subject).toBe("Custom subject");
	});
});
