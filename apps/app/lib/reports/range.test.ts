import { describe, expect, it } from "bun:test";
import { agingBucket, bucketMonths, presetRange } from "./range";

describe("agingBucket", () => {
	const now = new Date(2026, 8, 14);

	it("buckets a deal due today as current", () => {
		expect(agingBucket(new Date(2026, 8, 14), now)).toBe("current");
	});

	it("buckets a deal due in the future as current", () => {
		expect(agingBucket(new Date(2026, 8, 20), now)).toBe("current");
	});

	it("buckets one day past due as 1-30", () => {
		expect(agingBucket(new Date(2026, 8, 13), now)).toBe("1-30");
	});

	it("buckets exactly 30 days past due as 1-30, the upper edge", () => {
		expect(agingBucket(new Date(2026, 7, 15), now)).toBe("1-30");
	});

	it("buckets 31 days past due as 31-60", () => {
		expect(agingBucket(new Date(2026, 7, 14), now)).toBe("31-60");
	});

	it("buckets 60 days past due as 31-60, the upper edge", () => {
		expect(agingBucket(new Date(2026, 6, 16), now)).toBe("31-60");
	});

	it("buckets 61 days past due as 61-90", () => {
		expect(agingBucket(new Date(2026, 6, 15), now)).toBe("61-90");
	});

	it("buckets 90 days past due as 61-90, the upper edge", () => {
		expect(agingBucket(new Date(2026, 5, 16), now)).toBe("61-90");
	});

	it("buckets 91 days past due as 90+", () => {
		expect(agingBucket(new Date(2026, 5, 15), now)).toBe("90+");
	});
});

describe("bucketMonths", () => {
	it("returns a single month when from and to fall in the same month", () => {
		expect(bucketMonths(new Date(2026, 8, 1), new Date(2026, 8, 30))).toEqual([
			"2026-09",
		]);
	});

	it("is inclusive of both endpoints across a year boundary", () => {
		expect(bucketMonths(new Date(2025, 10, 5), new Date(2026, 1, 20))).toEqual([
			"2025-11",
			"2025-12",
			"2026-01",
			"2026-02",
		]);
	});
});

describe("presetRange", () => {
	const now = new Date(2026, 8, 14);

	it("30d spans 30 days inclusive of today", () => {
		const { from, to } = presetRange("30d", now);
		expect(to).toEqual(new Date(2026, 8, 14));
		expect(from).toEqual(new Date(2026, 7, 16));
	});

	it("90d spans 90 days inclusive of today", () => {
		const { from, to } = presetRange("90d", now);
		expect(to).toEqual(new Date(2026, 8, 14));
		expect(from).toEqual(new Date(2026, 5, 17));
	});

	it("12m spans the trailing twelve months", () => {
		const { from, to } = presetRange("12m", now);
		expect(to).toEqual(new Date(2026, 8, 14));
		expect(from).toEqual(new Date(2025, 9, 14));
	});
});
