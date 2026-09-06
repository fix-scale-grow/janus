import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	applyServiceUpdate,
	type ServiceSnapshot,
} from "../agent/lib/service-writes";

const suffix = process.env.TEST_RUN_ID ?? "service-writes-spec";
const serviceName = `Tear-off & disposal ${suffix}`;

let serviceId: string;

function snapshot(overrides: Partial<ServiceSnapshot> = {}): ServiceSnapshot {
	return {
		name: serviceName,
		unitPriceCents: 8500,
		priceGoodCents: 7500,
		priceBestCents: 9500,
		modifier: null,
		...overrides,
	};
}

beforeAll(async () => {
	await cleanup();

	const service = await db.service.create({
		data: {
			name: serviceName,
			unit: "PER_SQUARE",
			unitPriceCents: 8500,
			priceGoodCents: 7500,
			priceBestCents: 9500,
		},
		select: { id: true },
	});
	serviceId = service.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.service.deleteMany({ where: { name: serviceName } });
}

describe("applyServiceUpdate", () => {
	it("returns an applied:false, unchanged reason for no such service", async () => {
		const result = await applyServiceUpdate("no-such-service", snapshot(), {
			unitPriceCents: 9000,
		});
		expect(result).toEqual({ applied: false, reason: "No such service." });
	});

	it("refuses to apply when the claimed current price does not match the live row", async () => {
		const result = await applyServiceUpdate(
			serviceId,
			snapshot({ unitPriceCents: 1 }),
			{ unitPriceCents: 9000 },
		);

		expect(result.applied).toBe(false);
		if (result.applied) throw new Error("expected refusal");
		expect(result.reason).toContain("has changed since it was read");

		const row = await db.service.findUniqueOrThrow({
			where: { id: serviceId },
		});
		expect(row.unitPriceCents).toBe(8500);
	});

	it("applies the change and returns an old to new diff payload", async () => {
		const result = await applyServiceUpdate(serviceId, snapshot(), {
			unitPriceCents: 9000,
			name: `${serviceName} updated`,
		});

		expect(result.applied).toBe(true);
		if (!result.applied) throw new Error("expected applied result");
		expect(result.diff).toEqual(
			expect.arrayContaining([
				{ field: "unitPriceCents", from: 8500, to: 9000 },
				{ field: "name", from: serviceName, to: `${serviceName} updated` },
			]),
		);

		const row = await db.service.findUniqueOrThrow({
			where: { id: serviceId },
		});
		expect(row.unitPriceCents).toBe(9000);
		expect(row.name).toBe(`${serviceName} updated`);
	});

	it("refuses with nothing to change when the proposed value already matches the live row", async () => {
		const current = snapshot({
			unitPriceCents: 9000,
			name: `${serviceName} updated`,
		});
		const result = await applyServiceUpdate(serviceId, current, {
			unitPriceCents: 9000,
		});

		expect(result).toEqual({ applied: false, reason: "Nothing to change." });
	});
});
