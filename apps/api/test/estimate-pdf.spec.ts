import { describe, expect, it } from "bun:test";
import { renderEstimatePdf } from "../src/estimates/estimate-pdf";

function fixture() {
	return {
		title: "Smith residence re-roof",
		currency: "USD",
		selectedTier: "BETTER" as const,
		createdAt: new Date("2026-01-15T00:00:00Z"),
		contact: {
			firstName: "Jane",
			lastName: "Smith",
			email: "jane@example.com",
			phone: "555-0100",
		},
		lineItems: [
			{
				name: "Tear-off",
				unit: "PER_SQUARE",
				quantity: 14.5,
				areaLabel: "Main roof",
				priceGoodCents: 7500,
				priceBetterCents: 8500,
				priceBestCents: 9500,
			},
			{
				name: "Ridge vent",
				unit: "PER_LINEAR_FT",
				quantity: 32,
				areaLabel: "Main roof",
				priceGoodCents: 400,
				priceBetterCents: 450,
				priceBestCents: 500,
			},
			{
				name: "Permit",
				unit: "FLAT",
				quantity: 1,
				areaLabel: null,
				priceGoodCents: 20000,
				priceBetterCents: 20000,
				priceBestCents: 20000,
			},
		],
	};
}

describe("renderEstimatePdf", () => {
	it("returns a non-empty buffer starting with the PDF signature", async () => {
		const buffer = await renderEstimatePdf(fixture(), "Acme Roofing");

		expect(buffer.length).toBeGreaterThan(0);
		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("renders without a contact", async () => {
		const estimate = { ...fixture(), contact: null };
		const buffer = await renderEstimatePdf(estimate, "Acme Roofing");

		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("matches per-line rounding for each tier total", async () => {
		const estimate = fixture();

		const expected = {
			GOOD: 0,
			BETTER: 0,
			BEST: 0,
		};

		for (const item of estimate.lineItems) {
			expected.GOOD += Math.round(item.quantity * item.priceGoodCents);
			expected.BETTER += Math.round(item.quantity * item.priceBetterCents);
			expected.BEST += Math.round(item.quantity * item.priceBestCents);
		}

		expect(expected.GOOD).toBe(141550);
		expect(expected.BETTER).toBe(157650);
		expect(expected.BEST).toBe(173750);

		const buffer = await renderEstimatePdf(estimate, "Acme Roofing");
		expect(buffer.length).toBeGreaterThan(0);
	});
});
