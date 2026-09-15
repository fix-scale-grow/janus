import { describe, expect, test } from "bun:test";
import { ACCESS } from "./access-config";
import {
	type AccessPrincipal,
	adminPrincipal,
	allows,
	hasMoney,
	noAccessPrincipal,
	parseAccessPolicy,
	refusalMessage,
} from "./access-policy";

function clerk(): AccessPrincipal {
	const seed = ACCESS.seedGroups.find((g) => g.key === "sales-clerk");
	if (!seed) throw new Error("seed missing");
	return {
		userId: "u1",
		isAdmin: false,
		groupId: "g1",
		groupName: seed.name,
		surface: seed.surface,
		scope: seed.scope,
		policy: parseAccessPolicy(seed.policy, seed.name),
	};
}

describe("allows", () => {
	test("levels are cumulative", () => {
		const p = clerk();
		expect(allows(p, "deals", "VIEW")).toBe(true);
		expect(allows(p, "deals", "EDIT")).toBe(true);
		expect(allows(p, "deals", "DELETE")).toBe(false);
		expect(allows(p, "photos", "VIEW")).toBe(true);
		expect(allows(p, "photos", "EDIT")).toBe(false);
		expect(allows(p, "invoices", "VIEW")).toBe(false);
	});

	test("standalone actions do not imply view", () => {
		const seed = ACCESS.seedGroups.find((g) => g.key === "crew-lead");
		if (!seed) throw new Error("seed missing");
		const p: AccessPrincipal = {
			...clerk(),
			groupName: seed.name,
			surface: seed.surface,
			scope: seed.scope,
			policy: parseAccessPolicy(seed.policy, seed.name),
		};
		expect(allows(p, "jobCosts", "jobCosts.submit")).toBe(true);
		expect(allows(p, "jobCosts", "VIEW")).toBe(false);
		expect(allows(p, "jobCosts", ["EDIT", "jobCosts.submit"])).toBe(true);
	});

	test("admin allows everything, no-access allows nothing", () => {
		expect(allows(adminPrincipal("a"), "invoices", "DELETE")).toBe(true);
		expect(hasMoney(adminPrincipal("a"), "profit")).toBe(true);
		expect(allows(noAccessPrincipal("n"), "contacts", "VIEW")).toBe(false);
	});

	test("money switches", () => {
		expect(hasMoney(clerk(), "prices")).toBe(true);
		expect(hasMoney(clerk(), "profit")).toBe(false);
	});
});

describe("parseAccessPolicy", () => {
	test("rejects reports above VIEW", () => {
		const seed = ACCESS.seedGroups[0];
		if (!seed) throw new Error("seed missing");
		const bad = {
			...seed.policy,
			areas: { ...seed.policy.areas, reports: "EDIT" },
		};
		expect(() => parseAccessPolicy(bad, "Broken")).toThrow("Broken");
	});

	test("rejects missing areas", () => {
		expect(() =>
			parseAccessPolicy({ areas: {}, actions: [], money: [] }, "Empty"),
		).toThrow("Empty");
	});
});

test("refusal message names group and area", () => {
	expect(refusalMessage(clerk(), "invoices", "VIEW")).toBe(
		"Your group (Sales clerk) can't view invoices. Ask an admin.",
	);
});
