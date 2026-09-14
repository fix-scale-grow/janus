import { describe, expect, it } from "bun:test";
import { renderProposalPdf } from "../src/proposals/proposal-pdf";

function fixture() {
	return {
		number: 7,
		title: "Smith residence re-roof",
		coverTitle: "A new roof for the Smith family",
		coverSubtitle: "Three options, one warranty, zero surprises.",
		contactName: "Jane Smith",
		currency: "USD",
		selectedTier: "BETTER" as const,
		acceptedTier: null,
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
		],
		body: [
			{ kind: "heading" as const, text: "Why us" },
			{ kind: "text" as const, html: "Licensed and insured since 2004." },
		],
		context: { "business.name": "Acme Roofing" },
		photos: [],
		createdAt: new Date("2026-09-13T00:00:00Z"),
	};
}

describe("renderProposalPdf", () => {
	it("returns a PDF buffer", async () => {
		const buffer = await renderProposalPdf(fixture(), "Acme Roofing");
		expect(buffer.length).toBeGreaterThan(0);
		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("renders without cover copy or contact", async () => {
		const buffer = await renderProposalPdf(
			{
				...fixture(),
				coverTitle: null,
				coverSubtitle: null,
				contactName: null,
				body: [],
			},
			"Acme Roofing",
		);
		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("grows when body sections are present", async () => {
		const bare = await renderProposalPdf(
			{ ...fixture(), body: [] },
			"Acme Roofing",
		);
		const full = await renderProposalPdf(fixture(), "Acme Roofing");
		expect(full.length).toBeGreaterThan(bare.length);
	});
});
