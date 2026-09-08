import { describe, expect, it } from "bun:test";
import {
	projectCalendarInput,
	projectCreateInput,
	spanDays,
	taskCreateInput,
	taskMoveInput,
	taskUpdateInput,
	toDay,
} from "../src/projects/projects.contracts";

describe("toDay", () => {
	it("maps a timestamp to midnight UTC of the same day", () => {
		const result = toDay(new Date("2026-09-05T14:30:00Z"));

		expect(result.toISOString()).toBe("2026-09-05T00:00:00.000Z");
	});
});

describe("projectCreateInput", () => {
	it("rejects an empty object", () => {
		const result = projectCreateInput.safeParse({});

		expect(result.success).toBe(false);
	});

	it("rejects a 201-char name", () => {
		const result = projectCreateInput.safeParse({
			dealId: "deal_1",
			name: "a".repeat(201),
			startDate: "2026-09-05T00:00:00Z",
		});

		expect(result.success).toBe(false);
	});
});

describe("projectCalendarInput", () => {
	it("accepts a range and floors both ends to midnight UTC", () => {
		const result = projectCalendarInput.safeParse({
			from: "2026-09-01T14:30:00Z",
			to: "2026-10-12T08:00:00Z",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
			expect(result.data.to.toISOString()).toBe("2026-10-12T00:00:00.000Z");
		}
	});

	it("rejects a range that ends before it starts", () => {
		const result = projectCalendarInput.safeParse({
			from: "2026-09-10",
			to: "2026-09-08",
		});

		expect(result.success).toBe(false);
	});

	it("rejects a range over the cap", () => {
		const result = projectCalendarInput.safeParse({
			from: "2026-01-01",
			to: "2026-06-01",
		});

		expect(result.success).toBe(false);
	});

	it("accepts an optional status filter", () => {
		const result = projectCalendarInput.safeParse({
			from: "2026-09-01",
			to: "2026-09-30",
			status: "ACTIVE",
		});

		expect(result.success).toBe(true);
	});
});

describe("taskMoveInput", () => {
	it("accepts startDay/endDay: null", () => {
		const result = taskMoveInput.safeParse({
			id: "task_1",
			startDay: null,
			endDay: null,
			sortOrder: 0,
		});

		expect(result.success).toBe(true);
	});

	it("rejects a negative sortOrder", () => {
		const result = taskMoveInput.safeParse({
			id: "task_1",
			startDay: null,
			endDay: null,
			sortOrder: -1,
		});

		expect(result.success).toBe(false);
	});
});

describe("taskUpdateInput", () => {
	it("accepts note: null", () => {
		const result = taskUpdateInput.safeParse({
			id: "task_1",
			note: null,
		});

		expect(result.success).toBe(true);
	});
});

describe("task spans", () => {
	it("fills endDay from startDay on create", () => {
		const result = taskCreateInput.safeParse({
			projectId: "p1",
			name: "Tear-off",
			startDay: "2026-09-08T10:00:00Z",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.endDay?.toISOString()).toBe(
				"2026-09-08T00:00:00.000Z",
			);
		}
	});

	it("rejects an end day before the start day", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: "2026-09-10",
			endDay: "2026-09-08",
			sortOrder: 0,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a span over the cap", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: "2026-01-01",
			endDay: "2026-03-01",
			sortOrder: 0,
		});
		expect(result.success).toBe(false);
	});

	it("rejects one-sided spans on move", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: "2026-09-10",
			endDay: null,
			sortOrder: 0,
		});
		expect(result.success).toBe(false);
	});

	it("moves to unscheduled with both days null", () => {
		const result = taskMoveInput.safeParse({
			id: "t1",
			startDay: null,
			endDay: null,
			sortOrder: 0,
		});
		expect(result.success).toBe(true);
	});

	it("counts span days inclusively", () => {
		expect(
			spanDays(
				new Date("2026-09-06T00:00:00Z"),
				new Date("2026-09-08T00:00:00Z"),
			),
		).toBe(3);
	});
});
