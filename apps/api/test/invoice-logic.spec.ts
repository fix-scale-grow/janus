import { describe, expect, it } from "bun:test";
import { agingBucket, linesFromEstimate } from "../src/invoices/invoice-logic";

const NOW = new Date("2026-09-05T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("agingBucket", () => {
	it("is null for a DRAFT invoice even when the due date is past", () => {
		const dueAt = new Date(NOW.getTime() - DAY_MS);
		expect(agingBucket(dueAt, "DRAFT", NOW)).toBeNull();
	});

	it("is null for a PAID invoice", () => {
		const dueAt = new Date(NOW.getTime() - DAY_MS);
		expect(agingBucket(dueAt, "PAID", NOW)).toBeNull();
	});

	it("is null for a VOID invoice", () => {
		const dueAt = new Date(NOW.getTime() - DAY_MS);
		expect(agingBucket(dueAt, "VOID", NOW)).toBeNull();
	});

	it("is null when there is no due date", () => {
		expect(agingBucket(null, "SENT", NOW)).toBeNull();
	});

	it("is overdue when the due date has passed and the invoice is SENT", () => {
		const dueAt = new Date(NOW.getTime() - 1);
		expect(agingBucket(dueAt, "SENT", NOW)).toBe("overdue");
	});

	it("is due_soon at exactly 7 days out", () => {
		const dueAt = new Date(NOW.getTime() + 7 * DAY_MS);
		expect(agingBucket(dueAt, "SENT", NOW)).toBe("due_soon");
	});

	it("is current just past the 7 day boundary", () => {
		const dueAt = new Date(NOW.getTime() + 7 * DAY_MS + 1);
		expect(agingBucket(dueAt, "SENT", NOW)).toBe("current");
	});

	it("is current well beyond the due_soon window", () => {
		const dueAt = new Date(NOW.getTime() + 30 * DAY_MS);
		expect(agingBucket(dueAt, "SENT", NOW)).toBe("current");
	});

	it("is overdue at exactly the due instant", () => {
		expect(agingBucket(NOW, "SENT", NOW)).toBe("due_soon");
	});
});

function estimateLineItem(over: object) {
	return {
		name: "Tear-off",
		unit: "PER_SQUARE" as const,
		quantity: "10.00",
		areaLabel: "Main roof",
		sortOrder: 0,
		priceGoodCents: 7500,
		priceBetterCents: 8500,
		priceBestCents: 9500,
		...over,
	};
}

describe("linesFromEstimate", () => {
	it("copies the GOOD tier price when the tier is GOOD", () => {
		const lines = linesFromEstimate(
			{ lineItems: [estimateLineItem({})] },
			"GOOD",
		);
		expect(lines[0]?.priceCents).toBe(7500);
	});

	it("copies the BETTER tier price when the tier is BETTER", () => {
		const lines = linesFromEstimate(
			{ lineItems: [estimateLineItem({})] },
			"BETTER",
		);
		expect(lines[0]?.priceCents).toBe(8500);
	});

	it("copies the BEST tier price when the tier is BEST", () => {
		const lines = linesFromEstimate(
			{ lineItems: [estimateLineItem({})] },
			"BEST",
		);
		expect(lines[0]?.priceCents).toBe(9500);
	});

	it("preserves name, unit, areaLabel and sortOrder", () => {
		const lines = linesFromEstimate(
			{
				lineItems: [
					estimateLineItem({
						name: "Gutter guard",
						unit: "PER_LINEAR_FT",
						areaLabel: "North side",
						sortOrder: 3,
					}),
				],
			},
			"BETTER",
		);
		expect(lines[0]?.name).toBe("Gutter guard");
		expect(lines[0]?.unit).toBe("PER_LINEAR_FT");
		expect(lines[0]?.areaLabel).toBe("North side");
		expect(lines[0]?.sortOrder).toBe(3);
	});

	it("converts the decimal quantity string to a number", () => {
		const lines = linesFromEstimate(
			{ lineItems: [estimateLineItem({ quantity: "12.50" })] },
			"GOOD",
		);
		expect(lines[0]?.quantity).toBe(12.5);
	});

	it("keeps a null areaLabel null", () => {
		const lines = linesFromEstimate(
			{ lineItems: [estimateLineItem({ areaLabel: null })] },
			"GOOD",
		);
		expect(lines[0]?.areaLabel).toBeNull();
	});
});
