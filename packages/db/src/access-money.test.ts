import { describe, expect, test } from "bun:test";
import { maskCents, maskLineItems, moneyRefusalMessage } from "./access-money";
import { adminPrincipal, noAccessPrincipal } from "./access-policy";

const admin = adminPrincipal("u-admin");
const noMoney = noAccessPrincipal("u-none");
const priced = {
	...noAccessPrincipal("u-priced"),
	policy: {
		areas: noAccessPrincipal("u-priced").policy.areas,
		actions: [],
		money: ["prices" as const],
	},
};

describe("maskCents", () => {
	test("admin keeps the real value", () => {
		const row = { id: "1", priceCents: 500 };
		expect(maskCents(admin, "prices", row, ["priceCents"])).toEqual(row);
	});

	test("no money switch nulls the listed keys only", () => {
		const row = { id: "1", priceCents: 500, name: "x" };
		expect(maskCents(noMoney, "prices", row, ["priceCents"])).toEqual({
			id: "1",
			priceCents: null,
			name: "x",
		});
	});

	test("a principal with the switch keeps the value", () => {
		const row = { id: "1", priceCents: 500 };
		expect(maskCents(priced, "prices", row, ["priceCents"])).toEqual(row);
	});

	test("a different switch is unaffected by prices", () => {
		const row = { id: "1", profitCents: 10 };
		expect(maskCents(priced, "profit", row, ["profitCents"])).toEqual({
			id: "1",
			profitCents: null,
		});
	});
});

describe("maskLineItems", () => {
	test("maps maskCents across every row", () => {
		const rows = [
			{ id: "a", priceCents: 100 },
			{ id: "b", priceCents: 200 },
		];
		expect(maskLineItems(noMoney, "prices", rows, ["priceCents"])).toEqual([
			{ id: "a", priceCents: null },
			{ id: "b", priceCents: null },
		]);
		expect(maskLineItems(admin, "prices", rows, ["priceCents"])).toEqual(rows);
	});
});

describe("moneyRefusalMessage", () => {
	test("names the group when the principal has one", () => {
		const p = { ...noMoney, groupName: "Crew lead" };
		expect(moneyRefusalMessage(p, "see job costs and profit.")).toBe(
			"Your group (Crew lead) can't see job costs and profit. Ask an admin.",
		);
	});

	test("flags an ungrouped principal", () => {
		expect(moneyRefusalMessage(noMoney, "see job costs and profit.")).toBe(
			"You aren't in a group yet, so you can't see job costs and profit. Ask an admin.",
		);
	});
});
