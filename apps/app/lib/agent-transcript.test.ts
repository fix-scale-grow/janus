import { describe, expect, it } from "bun:test";
import type { EveMessage } from "eve/react";
import {
	pendingApproval,
	pendingQuestion,
	toTranscript,
} from "./agent-transcript";

function approvalMessage(
	overrides: Partial<{
		state:
			| "approval-requested"
			| "approval-responded"
			| "output-denied"
			| "output-available";
		approved: boolean | undefined;
	}> = {},
): EveMessage {
	const state = overrides.state ?? "approval-requested";
	const approved = overrides.approved;

	const base = {
		type: "dynamic-tool" as const,
		toolCallId: "call-1",
		toolName: "refund_charge",
		toolMetadata: {
			eve: {
				kind: "tool-call" as const,
				name: "refund_charge",
				inputRequest: {
					kind: "tool-approval" as const,
					requestId: "req-1",
					prompt: "Approve tool call: refund_charge",
					display: "confirmation" as const,
					allowFreeform: false,
					options: [
						{ id: "approve", label: "Yes" },
						{ id: "deny", label: "No" },
					],
				},
			},
		},
	};

	const part =
		state === "approval-requested"
			? {
					...base,
					state,
					input: { chargeId: "ch_1", amount: 42 },
					approval: { id: "approval-1" },
				}
			: state === "approval-responded"
				? {
						...base,
						state,
						input: { chargeId: "ch_1", amount: 42 },
						approval: { id: "approval-1", approved },
					}
				: state === "output-denied"
					? {
							...base,
							state,
							input: { chargeId: "ch_1", amount: 42 },
							approval: { id: "approval-1", approved: false as const },
						}
					: {
							...base,
							state,
							input: { chargeId: "ch_1", amount: 42 },
							output: { refunded: true },
							approval: { id: "approval-1", approved: true as const },
						};

	return {
		id: "msg-1",
		role: "assistant",
		parts: [part as never],
	};
}

function questionMessage(): EveMessage {
	return {
		id: "msg-2",
		role: "assistant",
		parts: [
			{
				type: "dynamic-tool",
				toolCallId: "call-2",
				toolName: "ask_question",
				state: "approval-requested",
				input: { prompt: "Which contact?" },
				approval: { id: "approval-2" },
				toolMetadata: {
					eve: {
						kind: "tool-call",
						name: "ask_question",
						inputRequest: {
							kind: "question",
							requestId: "req-2",
							prompt: "Which contact?",
							display: "text",
							allowFreeform: true,
						},
					},
				},
			} as never,
		],
	};
}

function ordinaryToolMessage(): EveMessage {
	return {
		id: "msg-3",
		role: "assistant",
		parts: [
			{
				type: "dynamic-tool",
				toolCallId: "call-3",
				toolName: "search_crm",
				state: "output-available",
				input: { query: "acme" },
				output: { found: true },
			} as never,
		],
	};
}

describe("tool-approval transcript items", () => {
	it("emits a pending tool-approval item with the parsed input", () => {
		const [transcript] = toTranscript([approvalMessage()]);
		const item = transcript?.items[0];

		expect(item?.kind).toBe("tool-approval");
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.requestId).toBe("req-1");
		expect(item.toolName).toBe("refund_charge");
		expect(item.input).toEqual({ chargeId: "ch_1", amount: 42 });
		expect(item.status).toBe("pending");
	});

	it("falls back to a null input when the tool input cannot be parsed as an object", () => {
		const message = approvalMessage();
		const part = message.parts[0] as Record<string, unknown>;
		part.input = "not-an-object";

		const [transcript] = toTranscript([message]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.input).toBeNull();
	});

	it("transitions to approved once the response records approval", () => {
		const [transcript] = toTranscript([
			approvalMessage({ state: "approval-responded", approved: true }),
		]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.status).toBe("approved");
	});

	it("transitions to denied once the response records denial", () => {
		const [transcript] = toTranscript([
			approvalMessage({ state: "approval-responded", approved: false }),
		]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.status).toBe("denied");
	});

	it("reads denied off the terminal output-denied state", () => {
		const [transcript] = toTranscript([
			approvalMessage({ state: "output-denied" }),
		]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.status).toBe("denied");
	});

	it("reads approved off the terminal output-available state", () => {
		const [transcript] = toTranscript([
			approvalMessage({ state: "output-available" }),
		]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.status).toBe("approved");
	});

	it("carries the tool's execute result once resolved", () => {
		const [transcript] = toTranscript([
			approvalMessage({ state: "output-available" }),
		]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.output).toEqual({ refunded: true });
	});

	it("has no output while the approval is still pending", () => {
		const [transcript] = toTranscript([approvalMessage()]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.output).toBeNull();
	});

	it("has no output when the response only records denial", () => {
		const [transcript] = toTranscript([
			approvalMessage({ state: "output-denied" }),
		]);
		const item = transcript?.items[0];
		if (item?.kind !== "tool-approval")
			throw new Error("expected tool-approval");
		expect(item.output).toBeNull();
	});

	it("surfaces the pending approval for the composer to lock on", () => {
		const approval = pendingApproval([approvalMessage()]);
		expect(approval).toEqual({
			requestId: "req-1",
			toolName: "refund_charge",
			input: { chargeId: "ch_1", amount: 42 },
		});
	});

	it("has no pending approval once the request is resolved", () => {
		expect(
			pendingApproval([approvalMessage({ state: "output-available" })]),
		).toBeNull();
	});
});

describe("question-kind requests are unaffected", () => {
	it("still produces an asked item, not a tool-approval item", () => {
		const [transcript] = toTranscript([questionMessage()]);
		const item = transcript?.items[0];
		expect(item?.kind).toBe("asked");
	});

	it("pendingQuestion still finds the question, pendingApproval ignores it", () => {
		const messages = [questionMessage()];
		expect(pendingQuestion(messages)?.requestId).toBe("req-2");
		expect(pendingApproval(messages)).toBeNull();
	});

	it("pendingApproval ignores a plain tool call with no input request", () => {
		expect(pendingApproval([ordinaryToolMessage()])).toBeNull();
	});

	it("an ordinary tool call still renders as a did item", () => {
		const [transcript] = toTranscript([ordinaryToolMessage()]);
		expect(transcript?.items[0]?.kind).toBe("did");
	});
});
