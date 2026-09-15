import { describe, expect, test } from "bun:test";
import { fieldRedirect, visibleModules } from "./access-rules";
import { JANUS_LIVE_NAV } from "./janus-nav";

const clerkMine = {
	isAdmin: false,
	groupId: "g",
	groupName: "Sales clerk",
	surface: "FULL",
	scope: "OWN",
	areas: {
		contacts: "EDIT",
		deals: "EDIT",
		drawings: "EDIT",
		estimates: "EDIT",
		contracts: "HIDDEN",
		invoices: "HIDDEN",
		projects: "HIDDEN",
		photos: "VIEW",
		permits: "HIDDEN",
		forms: "HIDDEN",
		jobCosts: "HIDDEN",
		reports: "HIDDEN",
	},
	actions: [],
	money: ["prices"],
} as const;

const fieldMine = {
	...clerkMine,
	surface: "FIELD",
} as const;

const adminMine = {
	isAdmin: true,
	groupId: null,
	groupName: null,
	surface: "FULL",
	scope: "ALL",
	areas: {
		contacts: "DELETE",
		deals: "DELETE",
		drawings: "DELETE",
		estimates: "DELETE",
		contracts: "DELETE",
		invoices: "DELETE",
		projects: "DELETE",
		photos: "DELETE",
		permits: "DELETE",
		forms: "DELETE",
		jobCosts: "DELETE",
		reports: "DELETE",
	},
	actions: [],
	money: ["prices", "profit", "priceBook"],
} as const;

describe("visibleModules", () => {
	test("clerk sees contacts, deals, drawings, estimates; not invoices or reports", () => {
		const hrefs = visibleModules(JANUS_LIVE_NAV, clerkMine).map((m) => m.href);
		expect(hrefs).toEqual(
			expect.arrayContaining([
				"/contacts",
				"/deals",
				"/drawings",
				"/estimates",
			]),
		);
		expect(hrefs).not.toContain("/invoices");
		expect(hrefs).not.toContain("/reports");
		expect(hrefs).not.toContain("/settings");
	});

	test("field surface only sees the field module", () => {
		const hrefs = visibleModules(JANUS_LIVE_NAV, fieldMine).map((m) => m.href);
		expect(hrefs).toEqual(["/field"]);
	});

	test("admin sees settings and every gated module", () => {
		const hrefs = visibleModules(JANUS_LIVE_NAV, adminMine).map((m) => m.href);
		expect(hrefs).toContain("/settings");
		expect(hrefs).toContain("/invoices");
		expect(hrefs).toContain("/reports");
	});

	test("modules with no area are always visible", () => {
		const hrefs = visibleModules(JANUS_LIVE_NAV, clerkMine).map((m) => m.href);
		expect(hrefs).toContain("/");
	});
});

describe("fieldRedirect", () => {
	test("field surface redirects non-field paths", () => {
		expect(fieldRedirect("FIELD", "/acme/deals", "acme")).toBe("/acme/field");
		expect(fieldRedirect("FIELD", "/acme/field/job/1", "acme")).toBeNull();
		expect(fieldRedirect("FULL", "/acme/deals", "acme")).toBeNull();
	});

	test("field surface at its own home does not redirect", () => {
		expect(fieldRedirect("FIELD", "/acme/field", "acme")).toBeNull();
	});

	test("null surface never redirects", () => {
		expect(fieldRedirect(null, "/acme/deals", "acme")).toBeNull();
	});
});
