import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { loadEstimateSummary } from "../agent/lib/estimate-summary";

const suffix = process.env.TEST_RUN_ID ?? "estimate-summary-spec";
const userId = `user-${suffix}`;
const contactEmail = `estimate-summary-${suffix}@example.test`;
const title = `Estimate summary fixture ${suffix}`;

let estimateId: string;
let contactId: string;

beforeAll(async () => {
	await cleanup();

	await db.user.create({
		data: {
			id: userId,
			name: "Estimate Summary Tester",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const contact = await db.contact.create({
		data: { firstName: "Estimate", lastName: "Summary", email: contactEmail },
		select: { id: true },
	});
	contactId = contact.id;

	const estimate = await db.estimate.create({
		data: { title, createdById: userId, contactId, status: "SENT" },
		select: { id: true },
	});
	estimateId = estimate.id;

	await db.estimateLineItem.createMany({
		data: [
			{
				estimateId,
				name: "Line A",
				unit: "PER_EACH",
				quantity: 0.5,
				priceGoodCents: 333,
				priceBetterCents: 999,
				priceBestCents: 1001,
				sortOrder: 0,
			},
			{
				estimateId,
				name: "Line B",
				unit: "PER_EACH",
				quantity: 0.5,
				priceGoodCents: 333,
				priceBetterCents: 999,
				priceBestCents: 1001,
				sortOrder: 1,
			},
		],
	});
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.estimate.deleteMany({ where: { title } });
	await db.contact.deleteMany({ where: { email: contactEmail } });
	await db.user.deleteMany({ where: { id: userId } });
}

describe("loadEstimateSummary", () => {
	it("rounds each line item before summing, matching the API's totals", async () => {
		const summary = await loadEstimateSummary(estimateId);

		if (!summary.found) throw new Error("expected the fixture to be found");

		expect(summary.status).toBe("SENT");
		expect(summary.contactId).toBe(contactId);
		expect(summary.lineItems).toHaveLength(2);

		expect(summary.totals.goodCents).toBe(334);
		expect(summary.totals.betterCents).toBe(1000);
		expect(summary.totals.bestCents).toBe(1002);
	});

	it("reports not found for an estimate that does not exist", async () => {
		const summary = await loadEstimateSummary("no-such-estimate");

		expect(summary).toEqual({ found: false, reason: "No such estimate." });
	});
});
