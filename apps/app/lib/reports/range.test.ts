import { describe, expect, it } from "bun:test";
import { effectiveRange, presetRange } from "./range";

describe("presetRange", () => {
	const now = new Date(2026, 8, 14);

	it("30d spans 30 days inclusive of today, as plain day dates", () => {
		const { from, to } = presetRange("30d", now);
		expect(to).toEqual(new Date(2026, 8, 14));
		expect(from).toEqual(new Date(2026, 7, 16));
	});

	it("90d spans 90 days inclusive of today, as plain day dates", () => {
		const { from, to } = presetRange("90d", now);
		expect(to).toEqual(new Date(2026, 8, 14));
		expect(from).toEqual(new Date(2026, 5, 17));
	});

	it("12m spans the trailing twelve months, as plain day dates", () => {
		const { from, to } = presetRange("12m", now);
		expect(to).toEqual(new Date(2026, 8, 14));
		expect(from).toEqual(new Date(2025, 9, 14));
	});
});

describe("effectiveRange", () => {
	const now = new Date(2026, 8, 14);

	it("resolves a preset to its computed dates", () => {
		expect(
			effectiveRange({ preset: "30d", from: null, to: null }, now),
		).toEqual(presetRange("30d", now));
	});

	it("passes through explicit custom dates", () => {
		const from = new Date(2026, 0, 1);
		const to = new Date(2026, 0, 31);
		expect(effectiveRange({ preset: "custom", from, to }, now)).toEqual({
			from,
			to,
		});
	});

	it("leaves an incomplete custom range undefined", () => {
		expect(
			effectiveRange({ preset: "custom", from: null, to: null }, now),
		).toEqual({ from: undefined, to: undefined });
	});
});
