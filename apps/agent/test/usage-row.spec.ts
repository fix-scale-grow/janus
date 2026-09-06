import { describe, expect, it } from "bun:test";
import { usageRowFrom } from "../agent/lib/usage-row";

const INPUT = {
	sessionId: "ses_1",
	conversationId: "conv_1",
	taskKind: "identify",
	model: "claude-sonnet-5",
};

describe("usageRowFrom", () => {
	it("maps tokens, model and session into the AgentUsage payload", () => {
		const row = usageRowFrom(
			{ usage: { inputTokens: 120, outputTokens: 40, costUsd: 0.01 } },
			INPUT,
		);

		expect(row).toEqual({
			...INPUT,
			inputTokens: 120,
			outputTokens: 40,
		});
	});

	it("carries a null conversationId and taskKind through unchanged", () => {
		const row = usageRowFrom(
			{ usage: { inputTokens: 5, outputTokens: 1 } },
			{ ...INPUT, conversationId: null, taskKind: null },
		);

		expect(row?.conversationId).toBeNull();
		expect(row?.taskKind).toBeNull();
	});

	it("is null, not a zeroed row, when there is no usage at all", () => {
		expect(usageRowFrom({}, INPUT)).toBeNull();
		expect(usageRowFrom({ finishReason: "stop" }, INPUT)).toBeNull();
	});

	it("is null when usage is present but both counts are zero", () => {
		expect(
			usageRowFrom({ usage: { inputTokens: 0, outputTokens: 0 } }, INPUT),
		).toBeNull();
	});

	it("treats a missing count as zero rather than throwing", () => {
		expect(usageRowFrom({ usage: { inputTokens: 10 } }, INPUT)).toEqual({
			...INPUT,
			inputTokens: 10,
			outputTokens: 0,
		});
	});

	it("does not throw on a malformed usage shape", () => {
		expect(usageRowFrom({ usage: "not an object" }, INPUT)).toBeNull();
		expect(usageRowFrom({ usage: [1, 2, 3] }, INPUT)).toBeNull();
		expect(usageRowFrom(null, INPUT)).toBeNull();
		expect(usageRowFrom(undefined, INPUT)).toBeNull();
	});

	it("ignores a non-numeric token count rather than coercing it", () => {
		expect(
			usageRowFrom({ usage: { inputTokens: "120", outputTokens: 40 } }, INPUT),
		).toEqual({ ...INPUT, inputTokens: 0, outputTokens: 40 });
	});
});
