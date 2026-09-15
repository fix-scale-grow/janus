import { describe, expect, test } from "bun:test";
import { parseGateAreas } from "./onboarding";

const areas = {
	contacts: "EDIT",
	deals: "EDIT",
	drawings: "EDIT",
	estimates: "VIEW",
	contracts: "HIDDEN",
	invoices: "HIDDEN",
	projects: "HIDDEN",
	photos: "VIEW",
	permits: "HIDDEN",
	forms: "HIDDEN",
	jobCosts: "HIDDEN",
	reports: "HIDDEN",
} as const;

describe("parseGateAreas", () => {
	test("a complete areas object becomes area access", () => {
		expect(parseGateAreas(false, areas)).toEqual({ isAdmin: false, areas });
	});

	test("missing areas give no area access", () => {
		expect(parseGateAreas(false, undefined)).toBeNull();
	});

	test("an unknown level is refused", () => {
		expect(
			parseGateAreas(false, { ...areas, invoices: "EVERYTHING" }),
		).toBeNull();
	});

	test("a missing area is refused", () => {
		const { reports: _reports, ...partial } = areas;
		expect(parseGateAreas(false, partial)).toBeNull();
	});
});
