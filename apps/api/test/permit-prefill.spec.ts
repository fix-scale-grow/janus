import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { PermitPrefillService } from "../src/permits/permit-prefill.service";

const suffix = process.env.TEST_RUN_ID ?? "permit-prefill-spec";

const prefill = new PermitPrefillService(db);

let userId: string;
let stageId: string;
let workspaceName: string;

beforeAll(async () => {
	const workspace = await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: "Test",
			slug: `ws-${suffix}`,
			createdAt: new Date(),
		},
		select: { name: true },
	});
	workspaceName = workspace.name;

	const user = await db.user.create({
		data: {
			id: `prefill-user-${suffix}`,
			name: "Prefill Rep",
			email: `prefill-rep-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	const stage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	stageId = stage.id;
});

afterAll(async () => {
	await db.user.deleteMany({ where: { id: userId } });
});

async function makeDeal(name: string) {
	return db.deal.create({
		data: { name, ownerId: userId, stageId },
		select: { id: true },
	});
}

describe("PermitPrefillService.resolve", () => {
	it("blanks every field for a deal with no data", async () => {
		const dealName = `Blank ${suffix}`;
		const deal = await makeDeal(dealName);

		const values = await prefill.resolve(deal.id);

		expect(values.job_address).toBe("");
		expect(values.job_valuation).toBe("");
		expect(values.owner_name).toBe("");
		expect(values.owner_email).toBe("");
		expect(values.owner_phone).toBe("");
		expect(values.scope_of_work).toBe("");
		expect(values.contractor_name).toBe(workspaceName);
		expect(values.job_name).toBe(dealName);

		await db.deal.deleteMany({ where: { id: deal.id } });
	});

	it("prefers a SENT estimate's selected-tier total over any invoice", async () => {
		const deal = await makeDeal(`Estimate Preferred ${suffix}`);

		const invoice = await db.invoice.create({
			data: {
				status: "SENT",
				currency: "USD",
				dealId: deal.id,
				createdById: userId,
				lineItems: {
					create: [
						{
							name: "Invoice item",
							unit: "PER_EACH",
							quantity: 1,
							priceCents: 50_000,
						},
					],
				},
			},
			select: { id: true },
		});

		const estimate = await db.estimate.create({
			data: {
				status: "SENT",
				currency: "USD",
				selectedTier: "BETTER",
				dealId: deal.id,
				createdById: userId,
				lineItems: {
					create: [
						{
							name: "Estimate item",
							unit: "PER_EACH",
							quantity: 2,
							priceGoodCents: 10_000,
							priceBetterCents: 12_000,
							priceBestCents: 15_000,
						},
					],
				},
			},
			select: { id: true },
		});

		const values = await prefill.resolve(deal.id);
		expect(values.job_valuation).toBe("$240.00");

		await db.estimate.deleteMany({ where: { id: estimate.id } });
		await db.invoice.deleteMany({ where: { id: invoice.id } });
		await db.deal.deleteMany({ where: { id: deal.id } });
	});

	it("falls back to the newest non-VOID invoice when there is no SENT/ACCEPTED estimate", async () => {
		const deal = await makeDeal(`Invoice Fallback ${suffix}`);

		const draftEstimate = await db.estimate.create({
			data: {
				status: "DRAFT",
				currency: "USD",
				selectedTier: "GOOD",
				dealId: deal.id,
				createdById: userId,
				lineItems: {
					create: [
						{
							name: "Draft item",
							unit: "PER_EACH",
							quantity: 1,
							priceGoodCents: 99_999,
							priceBetterCents: 99_999,
							priceBestCents: 99_999,
						},
					],
				},
			},
			select: { id: true },
		});

		const voidInvoice = await db.invoice.create({
			data: {
				status: "VOID",
				currency: "USD",
				dealId: deal.id,
				createdById: userId,
				lineItems: {
					create: [
						{
							name: "Void item",
							unit: "PER_EACH",
							quantity: 1,
							priceCents: 77_777,
						},
					],
				},
			},
			select: { id: true },
		});

		const sentInvoice = await db.invoice.create({
			data: {
				status: "SENT",
				currency: "USD",
				dealId: deal.id,
				createdById: userId,
				lineItems: {
					create: [
						{
							name: "Sent item",
							unit: "PER_EACH",
							quantity: 3,
							priceCents: 2_000,
						},
					],
				},
			},
			select: { id: true },
		});

		const values = await prefill.resolve(deal.id);
		expect(values.job_valuation).toBe("$60.00");

		await db.estimate.deleteMany({ where: { id: draftEstimate.id } });
		await db.invoice.deleteMany({
			where: { id: { in: [voidInvoice.id, sentInvoice.id] } },
		});
		await db.deal.deleteMany({ where: { id: deal.id } });
	});

	it("resolves owner fields from the deal's primary contact", async () => {
		const deal = await makeDeal(`Owner ${suffix}`);
		const contact = await db.contact.create({
			data: {
				firstName: "Priya",
				lastName: "Patel",
				email: `priya-${suffix}@example.test`,
				phone: "555-0199",
			},
			select: { id: true },
		});
		await db.dealContact.create({
			data: { dealId: deal.id, contactId: contact.id },
		});

		const values = await prefill.resolve(deal.id);
		expect(values.owner_name).toBe("Priya Patel");
		expect(values.owner_email).toBe(`priya-${suffix}@example.test`);
		expect(values.owner_phone).toBe("555-0199");

		await db.dealContact.deleteMany({ where: { dealId: deal.id } });
		await db.contact.deleteMany({ where: { id: contact.id } });
		await db.deal.deleteMany({ where: { id: deal.id } });
	});

	it("resolves job_address from the deal's most recently updated drawing", async () => {
		const deal = await makeDeal(`Address ${suffix}`);
		const drawing = await db.drawing.create({
			data: {
				title: "Roof plan",
				scene: {},
				address: "123 Main St, Denver, CO 80202",
				dealId: deal.id,
				createdById: userId,
			},
			select: { id: true },
		});

		const values = await prefill.resolve(deal.id);
		expect(values.job_address).toBe("123 Main St, Denver, CO 80202");

		await db.drawing.deleteMany({ where: { id: drawing.id } });
		await db.deal.deleteMany({ where: { id: deal.id } });
	});
});
