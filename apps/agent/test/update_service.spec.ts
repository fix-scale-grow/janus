import { describe, expect, it } from "bun:test";
import updateService from "../agent/tools/update_service";

function baseCurrent(overrides: Record<string, unknown> = {}) {
	return {
		name: "Tear-off & disposal",
		unitPriceCents: 8500,
		priceGoodCents: 7500,
		priceBestCents: 9500,
		modifier: null,
		...overrides,
	};
}

function baseInput(
	changes: Record<string, unknown>,
	currentOverrides: Record<string, unknown> = {},
) {
	return {
		serviceId: "cm1a2b3c4d5e6f7g8h9i0j1k2",
		current: baseCurrent(currentOverrides),
		changes,
	};
}

describe("update_service input schema", () => {
	it("accepts a well-formed price change", () => {
		const result = updateService.inputSchema.safeParse(
			baseInput({ unitPriceCents: 9000 }),
		);
		expect(result.success).toBe(true);
	});

	it("accepts a modifier change", () => {
		const result = updateService.inputSchema.safeParse(
			baseInput({
				modifier: { label: "Pitch", options: [{ name: "6/12", factor: 1.1 }] },
			}),
		);
		expect(result.success).toBe(true);
	});

	it("rejects a negative unitPriceCents", () => {
		const result = updateService.inputSchema.safeParse(
			baseInput({ unitPriceCents: -1 }),
		);
		expect(result.success).toBe(false);
	});

	it("rejects a unitPriceCents over the cap", () => {
		const result = updateService.inputSchema.safeParse(
			baseInput({ unitPriceCents: 100_000_000 }),
		);
		expect(result.success).toBe(false);
	});

	it("rejects a name over the cap", () => {
		const result = updateService.inputSchema.safeParse(
			baseInput({ name: "x".repeat(201) }),
		);
		expect(result.success).toBe(false);
	});

	it("rejects an empty changes object", () => {
		const result = updateService.inputSchema.safeParse(baseInput({}));
		expect(result.success).toBe(false);
	});

	it("rejects a current missing a required field", () => {
		const input = baseInput({ unitPriceCents: 9000 });
		const { modifier: _modifier, ...currentWithoutModifier } = input.current;
		const result = updateService.inputSchema.safeParse({
			...input,
			current: currentWithoutModifier,
		});
		expect(result.success).toBe(false);
	});
});

describe("update_service approval policy", () => {
	const input = baseInput({ unitPriceCents: 9000 });

	it("requires a person's approval for an interactive session", async () => {
		const decision = await updateService.approval?.({
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
			toolName: "update_service",
			toolInput: input,
			approvedTools: [],
			callId: "call1",
		} as never);

		expect(decision).toBe("user-approval");
	});

	it("refuses a dispatched session and never stalls", async () => {
		const decision = await updateService.approval?.({
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
			toolName: "update_service",
			toolInput: input,
			approvedTools: [],
			callId: "call2",
		} as never);

		expect(decision).toEqual({
			type: "denied",
			reason: expect.stringContaining("Propose the change in chat"),
		});
	});
});
