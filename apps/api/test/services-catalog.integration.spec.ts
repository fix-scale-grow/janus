import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { ROOFING_SEED } from "../src/services-catalog/roofing-seed";
import { ServicesCatalogService } from "../src/services-catalog/services-catalog.service";

const service = new ServicesCatalogService(db);

beforeAll(async () => {
	await db.service.deleteMany({ where: { trade: "roofing" } });
});

afterAll(async () => {
	await db.service.deleteMany({ where: { trade: "roofing" } });
});

describe("ServicesCatalogService.seedRoofing", () => {
	it("loads the roofing catalog into an empty workspace", async () => {
		const result = await service.seedRoofing();

		expect(result.created).toBe(ROOFING_SEED.length);

		const rows = await db.service.findMany({
			where: { trade: "roofing" },
			select: { name: true },
		});

		expect(rows).toHaveLength(ROOFING_SEED.length);
	});

	it("creates nothing on a second run and leaves no duplicate names", async () => {
		const result = await service.seedRoofing();

		expect(result.created).toBe(0);

		const rows = await db.service.findMany({
			where: { trade: "roofing" },
			select: { name: true },
		});

		expect(rows).toHaveLength(ROOFING_SEED.length);

		const names = rows.map((row) => row.name.toLowerCase());
		expect(new Set(names).size).toBe(names.length);
	});

	it("stays duplicate-free when two calls race", async () => {
		await db.service.deleteMany({ where: { trade: "roofing" } });

		const [first, second] = await Promise.all([
			service.seedRoofing(),
			service.seedRoofing(),
		]);

		expect(first.created + second.created).toBe(ROOFING_SEED.length);

		const rows = await db.service.findMany({
			where: { trade: "roofing" },
			select: { name: true },
		});

		expect(rows).toHaveLength(ROOFING_SEED.length);

		const names = rows.map((row) => row.name.toLowerCase());
		expect(new Set(names).size).toBe(names.length);
	});
});
