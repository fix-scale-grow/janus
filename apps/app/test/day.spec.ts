import { describe, expect, it } from "bun:test";
import {
	formatDay,
	fromDay,
	fromUtcDay,
	toDay,
	toUtcDay,
} from "@crm/ui/lib/format";

describe("day strings", () => {
	it("round-trips a date through its local parts", () => {
		const date = new Date(2026, 11, 31, 23, 30);
		expect(toDay(date)).toBe("2026-12-31");
		expect(toDay(fromDay(toDay(date)) as Date)).toBe("2026-12-31");
	});

	it("pads single-digit months and days", () => {
		expect(toDay(new Date(2026, 0, 5))).toBe("2026-01-05");
	});

	it("reads the day the server stored, not the local rendering of it", () => {
		expect(formatDay("2026-12-31T00:00:00.000Z")).toBe("Dec 31, 2026");
		expect(fromDay("2026-12-31T00:00:00.000Z")?.getDate()).toBe(31);
	});

	it("has nothing to show for nothing", () => {
		expect(fromDay(null)).toBeUndefined();
		expect(fromDay("")).toBeUndefined();
		expect(fromDay("someday")).toBeUndefined();
		expect(formatDay(null)).toBe("—");
	});
});

describe("stored day values", () => {
	it("reads a stored day as the day the server wrote", () => {
		expect(toUtcDay(new Date("2026-09-15T00:00:00.000Z"))).toBe("2026-09-15");
		expect(toUtcDay(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
	});

	it("writes a picked day back as that same day in UTC", () => {
		const written = fromUtcDay("2026-09-15");
		expect(written?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
		expect(toUtcDay(written as Date)).toBe("2026-09-15");
	});

	it("round-trips every day of a year in this timezone", () => {
		for (let index = 0; index < 365; index += 1) {
			const stored = new Date(Date.UTC(2026, 0, 1 + index));
			const day = toUtcDay(stored);
			expect(fromUtcDay(day)?.getTime()).toBe(stored.getTime());
		}
	});

	it("has nothing to show for nothing", () => {
		expect(fromUtcDay(null)).toBeUndefined();
		expect(fromUtcDay("")).toBeUndefined();
		expect(fromUtcDay("someday")).toBeUndefined();
	});
});
