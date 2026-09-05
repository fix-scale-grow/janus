import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import { InvoicesService } from "../src/invoices/invoices.service";
import type { MailerService } from "../src/mailer/mailer.service";

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
	return {
		isConfigured: () => true,
		send: async () => ({ delivered }),
	} as unknown as MailerService;
}

describe("InvoicesService.send", () => {
	it("throws and never flips status when delivery fails", async () => {
		const { db, updateData } = fakeDb(null);
		const service = new InvoicesService(db, fakeMailer(false));

		await expect(
			service.send({ id: "inv1", subject: "Invoice", message: "Hi" }),
		).rejects.toBeInstanceOf(BadRequestException);

		expect(updateData()).toBeNull();
	});

	it("sets status to SENT and stamps issuedAt when delivery succeeds", async () => {
		const { db } = fakeDb(null);
		const service = new InvoicesService(db, fakeMailer(true));

		const result = await service.send({
			id: "inv1",
			subject: "Invoice",
			message: "Hi",
		});

		expect(result.status).toBe("SENT");
		expect(result.issuedAt).toBeInstanceOf(Date);
	});

	it("does not overwrite issuedAt when already set", async () => {
		const existingIssuedAt = new Date("2026-01-05T00:00:00Z");
		const { db, updateData } = fakeDb(existingIssuedAt);
		const service = new InvoicesService(db, fakeMailer(true));

		const result = await service.send({
			id: "inv1",
			subject: "Invoice",
			message: "Hi",
		});

		expect(result.issuedAt).toEqual(existingIssuedAt);
		expect(updateData()?.issuedAt).toEqual(existingIssuedAt);
	});
});
