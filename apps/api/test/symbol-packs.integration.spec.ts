import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { SymbolsService } from "../src/symbols/symbols.service";

const suffix = process.env.TEST_RUN_ID ?? "symbol-packs-spec";

const service = new SymbolsService(db);

let roofVentServiceId: string;

beforeAll(async () => {
	const roofVentService = await db.service.create({
		data: {
			id: `service-${suffix}`,
			name: `Roof vent install ${suffix}`,
			trade: "roofing",
			unit: "PER_EACH",
			unitPriceCents: 5_000,
			symbolId: "janus-roofing-roof-vent",
		},
		select: { id: true },
	});
	roofVentServiceId = roofVentService.id;
});

afterAll(async () => {
	await db.symbol.deleteMany({
		where: { trade: { in: ["roofing", "landscaping", "building"] } },
	});
	await db.service.deleteMany({ where: { id: roofVentServiceId } });
});

describe("SymbolsService.seedPack", () => {
	it("installs the landscaping pack into an empty workspace", async () => {
		const result = await service.seedPack("landscaping");

		expect(result.created).toBe(14);

		const rows = await db.symbol.findMany({
			where: { trade: "landscaping" },
			select: { name: true, trade: true, serviceId: true },
		});

		expect(rows).toHaveLength(14);
		for (const row of rows) {
			expect(row.trade).toBe("landscaping");
			expect(row.serviceId).toBeNull();
		}
	});

	it("adds nothing on a second run of the same pack", async () => {
		const result = await service.seedPack("landscaping");

		expect(result.created).toBe(0);
	});

	it("seeds the roofing pack with service links", async () => {
		const result = await service.seedPack("roofing");

		expect(result.created).toBeGreaterThan(0);

		const linked = await db.symbol.findFirst({
			where: { name: "Roof vent" },
			select: { serviceId: true },
		});

		expect(linked?.serviceId).toBe(roofVentServiceId);
	});
});
