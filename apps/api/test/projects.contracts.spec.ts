import { describe, expect, it } from "bun:test";
import {
	projectCreateInput,
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

describe("taskMoveInput", () => {
	it("accepts day: null", () => {
		const result = taskMoveInput.safeParse({
			id: "task_1",
			day: null,
			sortOrder: 0,
		});

		expect(result.success).toBe(true);
	});

	it("rejects a negative sortOrder", () => {
		const result = taskMoveInput.safeParse({
			id: "task_1",
			day: null,
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
