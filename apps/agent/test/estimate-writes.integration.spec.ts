import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { applyEstimateLines } from "../agent/lib/estimate-writes";

const suffix = process.env.TEST_RUN_ID ?? "estimate-writes-spec";
const userId = `user-${suffix}`;
const title = `Estimate writes fixture ${suffix}`;
const serviceName = `Ridge vent ${suffix}`;

let estimateId: string;
let serviceId: string;

beforeAll(async () => {
	await cleanup();

	await db.user.create({
		data: {
			id: userId,
			name: "Estimate Writes Tester",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const service = await db.service.create({
		data: {
			name: serviceName,
			unit: "PER_LINEAR_FT",
			unitPriceCents: 500,
			priceGoodCents: 400,
			priceBestCents: 700,
		},
		select: { id: true },
	});
	serviceId = service.id;

	const estimate = await db.estimate.create({
		data: { title, createdById: userId },
		select: { id: true },
	});
	estimateId = estimate.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.estimate.deleteMany({ where: { title } });
	await db.service.deleteMany({ where: { name: serviceName } });
	await db.user.deleteMany({ where: { id: userId } });
}

describe("applyEstimateLines", () => {
	it("copies current book prices onto a serviceId line and adds a zero-priced custom line, appending sortOrder", async () => {
		const result = await applyEstimateLines(estimateId, [
			{
				serviceId,
				name: "Ridge vent (proposed)",
				unit: "PER_EACH",
				quantity: 40,
			},
			{
				name: "Custom flashing detail",
				unit: "PER_EACH",
				quantity: 2,
			},
		]);

		expect(result.applied).toBe(true);
		if (!result.applied) throw new Error("expected applied result");
		expect(result.lineItemIds).toHaveLength(2);

		const lines = await db.estimateLineItem.findMany({
			where: { id: { in: result.lineItemIds } },
			orderBy: { sortOrder: "asc" },
		});

		expect(lines[0]?.serviceId).toBe(serviceId);
		expect(lines[0]?.name).toBe(serviceName);
		expect(lines[0]?.unit).toBe("PER_LINEAR_FT");
		expect(lines[0]?.priceGoodCents).toBe(400);
		expect(lines[0]?.priceBetterCents).toBe(500);
		expect(lines[0]?.priceBestCents).toBe(700);
		expect(lines[0]?.sortOrder).toBe(0);

		expect(lines[1]?.serviceId).toBeNull();
		expect(lines[1]?.name).toBe("Custom flashing detail");
		expect(lines[1]?.priceGoodCents).toBe(0);
		expect(lines[1]?.priceBetterCents).toBe(0);
		expect(lines[1]?.priceBestCents).toBe(0);
		expect(lines[1]?.sortOrder).toBe(1);
	});

	it("appends sortOrder after the current maximum on a later call", async () => {
		const result = await applyEstimateLines(estimateId, [
			{ name: "Another custom line", unit: "PER_EACH", quantity: 1 },
		]);

		expect(result.applied).toBe(true);
		if (!result.applied) throw new Error("expected applied result");

		const line = await db.estimateLineItem.findUniqueOrThrow({
			where: { id: result.lineItemIds[0] },
		});
		expect(line.sortOrder).toBe(2);
	});

	it("reports failure for an estimate that does not exist", async () => {
		const result = await applyEstimateLines("no-such-estimate", [
			{ name: "Whatever", unit: "PER_EACH", quantity: 1 },
		]);

		expect(result).toEqual({ applied: false, reason: "No such estimate." });
	});

	it("reports failure when a proposed serviceId does not exist", async () => {
		const result = await applyEstimateLines(estimateId, [
			{
				serviceId: "no-such-service",
				name: "x",
				unit: "PER_EACH",
				quantity: 1,
			},
		]);

		expect(result).toEqual({
			applied: false,
			reason: "No service with id no-such-service.",
		});
	});
});
