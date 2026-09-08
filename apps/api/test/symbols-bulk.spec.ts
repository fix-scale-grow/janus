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
