import { describe, expect, it } from "bun:test";
import { brief } from "../agent/lib/dispatch";
import { parseDrawingCheckPayload } from "../agent/lib/drawing-check-payload";
import type { LeasedTask } from "../agent/lib/tasks";

function task(overrides: Partial<LeasedTask> = {}): LeasedTask {
	return {
		id: "task1",
		contactId: null,
		dealId: null,
		drawingId: "drawing1",
		kind: "drawing-check",
		reason: "An estimate was just generated from this drawing.",
		payload: null,
		budget: 6,
		attempts: 1,
		priority: 300,
		dueAt: new Date(),
		...overrides,
	};
}

describe("parseDrawingCheckPayload", () => {
	it("parses a payload carrying an estimateId", () => {
		expect(parseDrawingCheckPayload({ estimateId: "est1" })).toEqual({
			estimateId: "est1",
		});
	});

	it("returns null for a missing or unparseable payload", () => {
		expect(parseDrawingCheckPayload(null)).toBeNull();
		expect(parseDrawingCheckPayload({})).toBeNull();
		expect(parseDrawingCheckPayload({ estimateId: "" })).toBeNull();
		expect(parseDrawingCheckPayload({ estimateId: 4 })).toBeNull();
	});
});

describe("brief for a drawing-check task", () => {
	it("tells the model which estimateId to pass to review_drawing", () => {
		const message = brief(task({ payload: { estimateId: "est1" } }));

		expect(message).toContain('estimateId "est1"');
		expect(message).toContain("review_drawing");
	});

	it("still asks for a review when the payload carries no estimateId", () => {
		const message = brief(task({ payload: null }));

		expect(message).toContain("review_drawing");
		expect(message).not.toContain("estimateId");
	});
});
