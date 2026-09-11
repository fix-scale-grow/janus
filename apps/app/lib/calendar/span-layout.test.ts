import { describe, expect, it } from "bun:test";
import { addDays, dayKey, layoutWeek, monthWeeks, weekOf } from "./span-layout";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const task = (id: string, start: string, end: string, sortOrder = 0) => ({
	id,
	startDay: day(start),
	endDay: day(end),
	sortOrder,
});

describe("monthWeeks", () => {
	it("covers September 2026 in five Sunday-start weeks", () => {
		const weeks = monthWeeks(day("2026-09-15"));
		expect(weeks.length).toBe(5);
		const first = weeks[0]?.[0];
		const last = weeks[4]?.[6];
		if (!first || !last) throw new Error("missing calendar cells");
		expect(dayKey(first)).toBe("2026-08-30");
		expect(dayKey(last)).toBe("2026-10-03");
		for (const week of weeks) expect(week.length).toBe(7);
	});
});

describe("layoutWeek", () => {
	const weekStart = day("2026-09-06");

	it("places a three-day task in one bar", () => {
		const { bars, overflow } = layoutWeek(
			[task("a", "2026-09-06", "2026-09-08")],
			weekStart,
			4,
		);
		expect(bars).toEqual([
			{
				task: task("a", "2026-09-06", "2026-09-08"),
				startCol: 0,
				endCol: 2,
				lane: 0,
				clippedStart: false,
				clippedEnd: false,
			},
		]);
		expect(overflow).toEqual([0, 0, 0, 0, 0, 0, 0]);
	});

	it("clips a task that runs past the week and stacks overlaps into lanes", () => {
		const { bars } = layoutWeek(
			[
				task("a", "2026-09-03", "2026-09-09"),
				task("b", "2026-09-07", "2026-09-07"),
			],
			weekStart,
			4,
		);
		const barA = bars.find((bar) => bar.task.id === "a");
		const barB = bars.find((bar) => bar.task.id === "b");
		if (!barA || !barB) throw new Error("missing bars");
		expect(barA).toMatchObject({
			startCol: 0,
			endCol: 3,
			lane: 0,
			clippedStart: true,
			clippedEnd: false,
		});
		expect(barB).toMatchObject({ startCol: 1, endCol: 1, lane: 1 });
	});

	it("drops the excess into overflow counts", () => {
		const tasks = ["a", "b", "c", "d", "e"].map((id, index) =>
			task(id, "2026-09-07", "2026-09-07", index),
		);
		const { bars, overflow } = layoutWeek(tasks, weekStart, 4);
		expect(bars.length).toBe(4);
		expect(overflow[1]).toBe(1);
	});

	it("excludes tasks outside the week", () => {
		const { bars } = layoutWeek(
			[task("a", "2026-09-20", "2026-09-21")],
			weekStart,
			4,
		);
		expect(bars).toEqual([]);
	});
});

describe("day math", () => {
	it("addDays stays in UTC", () => {
		expect(dayKey(addDays(day("2026-08-31"), 1))).toBe("2026-09-01");
	});
	it("weekOf returns the Sunday-start week", () => {
		const sunday = weekOf(day("2026-09-09"))[0];
		if (!sunday) throw new Error("missing week start");
		expect(dayKey(sunday)).toBe("2026-09-06");
	});
});
