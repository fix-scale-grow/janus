import { describe, expect, it } from "bun:test";
import {
	addDays,
	dayKey,
	dayRange,
} from "../app/(app)/[slug]/projects/[id]/day-range";

function utc(year: number, month: number, day: number): Date {
	return new Date(Date.UTC(year, month, day));
}

describe("addDays", () => {
	it("moves forward by whole days", () => {
		expect(addDays(utc(2026, 0, 1), 5)).toEqual(utc(2026, 0, 6));
	});
});

describe("dayKey", () => {
	it("formats a day as its ISO date", () => {
		expect(dayKey(utc(2026, 0, 1))).toBe("2026-01-01");
	});

	it("has one key for no day at all", () => {
		expect(dayKey(null)).toBe("unscheduled");
	});
});

describe("dayRange", () => {
	it("spans start through goal inclusive of both ends", () => {
		const days = dayRange({
			startDate: utc(2026, 0, 1),
			goalDate: utc(2026, 0, 5),
			taskDays: [],
			today: utc(2026, 0, 1),
			max: 90,
		});

		expect(days).toEqual([
			utc(2026, 0, 1),
			utc(2026, 0, 2),
			utc(2026, 0, 3),
			utc(2026, 0, 4),
			utc(2026, 0, 5),
		]);
	});

	it("extends past the goal when today is later", () => {
		const days = dayRange({
			startDate: utc(2026, 0, 1),
			goalDate: utc(2026, 0, 5),
			taskDays: [],
			today: utc(2026, 0, 10),
			max: 90,
		});

		expect(days).toHaveLength(10);
		expect(days[0]).toEqual(utc(2026, 0, 1));
		expect(days.at(-1)).toEqual(utc(2026, 0, 10));
	});

	it("truncates a 200-day goal to max but still surfaces a scheduled task past it", () => {
		const startDate = utc(2026, 0, 1);
		const goalDate = addDays(startDate, 199);
		const scheduledTaskDay = addDays(startDate, 149);

		const days = dayRange({
			startDate,
			goalDate,
			taskDays: [scheduledTaskDay],
			today: startDate,
			max: 90,
		});

		expect(days).toHaveLength(91);
		expect(days.slice(0, 90)).toEqual(
			Array.from({ length: 90 }, (_, index) => addDays(startDate, index)),
		);
		expect(days.at(-1)).toEqual(scheduledTaskDay);
		expect(days).toContainEqual(scheduledTaskDay);
	});

	it("spans start through today when there is no goal and no tasks", () => {
		const days = dayRange({
			startDate: utc(2026, 0, 1),
			goalDate: null,
			taskDays: [],
			today: utc(2026, 0, 10),
			max: 90,
		});

		expect(days).toHaveLength(10);
		expect(days[0]).toEqual(utc(2026, 0, 1));
		expect(days.at(-1)).toEqual(utc(2026, 0, 10));
	});
});
