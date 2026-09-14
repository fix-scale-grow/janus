import { describe, expect, it } from "bun:test";
import {
	agingBucket,
	dateInRange,
	monthsBetween,
	resolveRange,
} from "../src/reports/reports-logic";

describe("monthsBetween", () => {
	it("returns a single month when from and to fall in the same month", () => {
		expect(
			monthsBetween(
				new Date(Date.UTC(2026, 8, 1)),
				new Date(Date.UTC(2026, 8, 30)),
			),
		).toEqual(["2026-09"]);
	});

	it("is inclusive of both endpoints across a year boundary", () => {
		expect(
			monthsBetween(
				new Date(Date.UTC(2025, 10, 5)),
				new Date(Date.UTC(2026, 1, 20)),
			),
		).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
	});
});

describe("agingBucket pinned edges", () => {
	const now = new Date(Date.UTC(2026, 8, 14));

	it("due today is current", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 8, 14)), now)).toBe("current");
	});

	it("due in the future is current", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 8, 20)), now)).toBe("current");
	});

	it("one day past due is 1-30", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 8, 13)), now)).toBe("1-30");
	});
});

describe("resolveRange", () => {
	it("truncates to to the start of its day and adds one exclusive day", () => {
		const from = new Date(Date.UTC(2026, 0, 1));
		const to = new Date(Date.UTC(2026, 0, 31, 23, 0, 0));
		const range = resolveRange(from, to);
		expect(range.gte).toEqual(from);
		expect(range.lt).toEqual(new Date(Date.UTC(2026, 1, 1)));
	});

	it("includes a timestamp at 23:00 UTC on the to day", () => {
		const from = new Date(Date.UTC(2026, 0, 1));
		const to = new Date(Date.UTC(2026, 0, 31));
		const range = resolveRange(from, to);
		const lateOnToDay = new Date(Date.UTC(2026, 0, 31, 23, 0, 0));
		expect(dateInRange(lateOnToDay, range)).toBe(true);
	});

	it("excludes a timestamp on the day after to", () => {
		const from = new Date(Date.UTC(2026, 0, 1));
		const to = new Date(Date.UTC(2026, 0, 31));
		const range = resolveRange(from, to);
		const nextDay = new Date(Date.UTC(2026, 1, 1, 0, 0, 0));
		expect(dateInRange(nextDay, range)).toBe(false);
	});
});
