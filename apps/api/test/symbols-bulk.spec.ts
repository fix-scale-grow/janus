import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { SymbolsService } from "../src/symbols/symbols.service";

const suffix = process.env.TEST_RUN_ID ?? "symbols-bulk-spec";
const namePrefix = `Symbols bulk ${suffix}`;

const symbols = new SymbolsService(db);

const elements = [
	{
		id: "rect-1",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
	},
];

async function clean() {
	await db.symbol.deleteMany({
		where: { name: { startsWith: namePrefix } },
	});
}

let firstId: string;
let secondId: string;
let thirdId: string;

beforeAll(async () => {
	await clean();

	const first = await symbols.create({
		name: `${namePrefix} one`,
		trade: "roofing",
		elements,
		active: true,
	});
	const second = await symbols.create({
		name: `${namePrefix} two`,
		trade: "roofing",
		elements,
		active: true,
	});
	const third = await symbols.create({
		name: `${namePrefix} three`,
		trade: "roofing",
		elements,
		active: true,
	});

	firstId = first.id;
	secondId = second.id;
	thirdId = third.id;
});

afterAll(clean);

describe("moving a selection to a category", () => {
	it("sets the trade on every symbol it was given", async () => {
		expect(
			await symbols.bulkSetTrade([firstId, secondId], "landscaping"),
		).toEqual({ count: 2 });

		const moved = await db.symbol.findMany({
			where: { id: { in: [firstId, secondId] } },
			select: { trade: true },
		});
		expect(moved.every((row) => row.trade === "landscaping")).toBe(true);

		const untouched = await db.symbol.findUnique({
			where: { id: thirdId },
			select: { trade: true },
		});
		expect(untouched?.trade).toBe("roofing");
	});
});

describe("linking a selection to a service", () => {
	const servicePrefix = `Symbols bulk service ${suffix}`;
	let serviceId: string;
	let linkFirstId: string;
	let linkSecondId: string;

	beforeAll(async () => {
		await db.service.deleteMany({
			where: { name: { startsWith: servicePrefix } },
		});

		const service = await db.service.create({
			data: {
				name: `${servicePrefix} one`,
				unit: "PER_EACH",
				unitPriceCents: 100,
				active: true,
			},
		});
		serviceId = service.id;

		const first = await symbols.create({
			name: `${namePrefix} link one`,
			trade: "roofing",
			elements,
			active: true,
		});
		const second = await symbols.create({
			name: `${namePrefix} link two`,
			trade: "roofing",
			elements,
			active: true,
		});
		linkFirstId = first.id;
		linkSecondId = second.id;
	});

	afterAll(async () => {
		await db.service.deleteMany({
			where: { name: { startsWith: servicePrefix } },
		});
	});

	it("links every symbol it was given", async () => {
		expect(
			await symbols.bulkSetService([linkFirstId, linkSecondId], serviceId),
		).toEqual({ count: 2 });

		const linked = await db.symbol.findMany({
			where: { id: { in: [linkFirstId, linkSecondId] } },
			select: { serviceId: true },
		});
		expect(linked.every((row) => row.serviceId === serviceId)).toBe(true);
	});

	it("unlinks every symbol it was given", async () => {
		expect(
			await symbols.bulkSetService([linkFirstId, linkSecondId], null),
		).toEqual({ count: 2 });

		const unlinked = await db.symbol.findMany({
			where: { id: { in: [linkFirstId, linkSecondId] } },
			select: { serviceId: true },
		});
		expect(unlinked.every((row) => row.serviceId === null)).toBe(true);
	});
});

describe("duplicating a symbol", () => {
	let originalId: string;

	beforeAll(async () => {
		const original = await symbols.create({
			name: `${namePrefix} dup`,
			trade: "roofing",
			elements,
			active: true,
		});
		originalId = original.id;
	});

	it("names the first copy 'copy'", async () => {
		const copy = await symbols.duplicate(originalId);
		expect(copy.name).toBe(`${namePrefix} dup copy`);
	});

	it("increments the name when a copy already exists", async () => {
		const copy = await symbols.duplicate(originalId);
		expect(copy.name).toBe(`${namePrefix} dup copy 2`);
	});
});

describe("counting drawing usage", () => {
	const userId = `symbols-usage-${suffix}`;
	const drawingTitle = `Symbols usage fixture ${suffix}`;
	let usedSymbolId: string;
	let unusedSymbolId: string;

	beforeAll(async () => {
		await db.drawing.deleteMany({ where: { title: drawingTitle } });
		await db.user.deleteMany({ where: { id: userId } });

		const used = await symbols.create({
			name: `${namePrefix} used`,
			trade: "roofing",
			elements,
			active: true,
		});
		const unused = await symbols.create({
			name: `${namePrefix} unused`,
			trade: "roofing",
			elements,
			active: true,
		});
		usedSymbolId = used.id;
		unusedSymbolId = unused.id;

		await db.user.create({
			data: {
				id: userId,
				name: "Symbols Usage Tester",
				email: `${userId}@example.test`,
				emailVerified: true,
			},
		});

		await db.drawing.create({
			data: {
				title: drawingTitle,
				createdById: userId,
				scene: {
					elements: [
						{
							id: "pin-1",
							type: "ellipse",
							customData: { symbol: usedSymbolId },
						},
						{
							id: "pin-2",
							type: "ellipse",
							customData: { symbol: usedSymbolId },
						},
					],
				},
			},
		});
	});

	afterAll(async () => {
		await db.drawing.deleteMany({ where: { title: drawingTitle } });
		await db.user.deleteMany({ where: { id: userId } });
	});

	it("counts a drawing once no matter how many times a symbol is placed", async () => {
		const rows = await symbols.usage();

		const used = rows.find((row) => row.symbolId === usedSymbolId);
		const unused = rows.find((row) => row.symbolId === unusedSymbolId);

		expect(used?.drawings).toBe(1);
		expect(unused?.drawings).toBe(0);
	});
});

describe("deleting a selection", () => {
	it("removes only the symbols it was given", async () => {
		expect(await symbols.bulkDelete([firstId, secondId])).toEqual({
			count: 2,
		});

		expect(
			await db.symbol.count({ where: { id: { in: [firstId, secondId] } } }),
		).toBe(0);

		expect(
			await db.symbol.findUnique({ where: { id: thirdId } }),
		).not.toBeNull();
	});

	it("counts only the rows that actually existed", async () => {
		expect(await symbols.bulkDelete([thirdId, `missing-${suffix}`])).toEqual({
			count: 1,
		});

		expect(await db.symbol.findUnique({ where: { id: thirdId } })).toBeNull();
	});
});
