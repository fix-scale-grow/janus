import { describe, expect, it } from "bun:test";
import attachDrawing from "../agent/tools/attach_drawing";

function ctx(auth: {
	authenticator: string;
	principalId: string;
	principalType: string;
}) {
	return {
		session: {
			id: "session1",
			auth: {
				current: { ...auth, attributes: {} },
				initiator: null,
			},
			turn: { id: "turn1" },
		},
		callId: "call1",
		toolName: "attach_drawing",
		abortSignal: new AbortController().signal,
		getSandbox: () => {
			throw new Error("not available in this test");
		},
		getSkill: () => {
			throw new Error("not available in this test");
		},
		getToken: () => {
			throw new Error("not available in this test");
		},
		requireAuth: () => {
			throw new Error("not available in this test");
		},
	} as never;
}

describe("attach_drawing unattended refusal", () => {
	it("refuses a dispatched session before touching the database", async () => {
		const result = await attachDrawing.execute(
			{ drawingId: "drawing1", dealId: "deal1" },
			ctx({
				authenticator: "app",
				principalId: "eve:app",
				principalType: "runtime",
			}),
		);

		expect(result).toEqual({
			attached: false,
			reason: expect.stringContaining("Not something to do unattended"),
		});
	});
});
