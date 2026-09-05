import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import type { ContactsService } from "../src/contacts/contacts.service";
import { EstimatesService } from "../src/estimates/estimates.service";
import type { MailerService } from "../src/mailer/mailer.service";

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
	return {
		isConfigured: () => true,
		send: async () => ({ delivered }),
	} as unknown as MailerService;
}

const noContacts = {} as unknown as ContactsService;

describe("EstimatesService.send", () => {
	it("throws and never flips status when delivery fails", async () => {
		const { db, wasUpdateCalled } = fakeDb();
		const service = new EstimatesService(db, noContacts, fakeMailer(false));

		await expect(
			service.send({ id: "est1", subject: "Estimate", message: "Hi" }),
		).rejects.toBeInstanceOf(BadRequestException);

		expect(wasUpdateCalled()).toBe(false);
	});

	it("sets status to SENT when delivery succeeds", async () => {
		const { db } = fakeDb();
		const service = new EstimatesService(db, noContacts, fakeMailer(true));

		const result = await service.send({
			id: "est1",
			subject: "Estimate",
			message: "Hi",
		});

		expect(result.status).toBe("SENT");
	});
});
