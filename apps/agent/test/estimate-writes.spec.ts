import { describe, expect, it } from "bun:test";
import proposeEstimateLines from "../agent/tools/propose_estimate_lines";

function baseLine(overrides: Record<string, unknown> = {}) {
	return {
		name: "Ridge vent",
		unit: "PER_LINEAR_FT",
		quantity: 40,
		reason: "Noted on the drawing but not priced yet.",
		source: "note",
		...overrides,
	};
}

function baseInput(lines: unknown[]) {
	return {
		estimateId: "cm1a2b3c4d5e6f7g8h9i0j1k2",
		estimateTitle: "123 Main St re-roof",
		lines,
	};
}

describe("propose_estimate_lines input schema", () => {
	it("accepts a well-formed line", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput([baseLine()]),
		);
		expect(result.success).toBe(true);
	});

	it("accepts a display-only unitPriceCents within the cap", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput([baseLine({ unitPriceCents: 450 })]),
		);
		expect(result.success).toBe(true);
	});

	it("rejects a unitPriceCents over the cap", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput([baseLine({ unitPriceCents: 100_000_000 })]),
		);
		expect(result.success).toBe(false);
	});

	it("rejects a negative unitPriceCents", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput([baseLine({ unitPriceCents: -1 })]),
		);
		expect(result.success).toBe(false);
	});

	it("rejects a quantity over the cap", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput([baseLine({ quantity: 10_000_000 })]),
		);
		expect(result.success).toBe(false);
	});

	it("rejects a non-positive quantity", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput([baseLine({ quantity: 0 })]),
		);
		expect(result.success).toBe(false);
	});

	it("rejects an unknown source", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput([baseLine({ source: "guess" })]),
		);
		expect(result.success).toBe(false);
	});

	it("rejects more lines than the cap", () => {
		const result = proposeEstimateLines.inputSchema.safeParse(
			baseInput(Array.from({ length: 31 }, () => baseLine())),
		);
		expect(result.success).toBe(false);
	});
});

describe("propose_estimate_lines approval policy", () => {
	const input = baseInput([baseLine()]);

	it("requires a person's approval for an interactive session", async () => {
		const decision = await proposeEstimateLines.approval?.({
			session: {
				auth: {
					current: {
						authenticator: "better-auth",
						principalId: "user1",
						principalType: "user",
					},
					initiator: null,
				},
			},
			toolName: "propose_estimate_lines",
			toolInput: input,
			approvedTools: [],
			callId: "call1",
		} as never);

		expect(decision).toBe("user-approval");
	});

	it("refuses a dispatched session and never stalls", async () => {
		const decision = await proposeEstimateLines.approval?.({
			session: {
				auth: {
					current: {
						authenticator: "app",
						principalId: "eve:app",
						principalType: "runtime",
					},
					initiator: null,
				},
			},
			toolName: "propose_estimate_lines",
			toolInput: input,
			approvedTools: [],
			callId: "call2",
		} as never);

		expect(decision).toEqual({
			type: "denied",
			reason: expect.stringContaining("Propose the line items in chat"),
		});
	});
});
