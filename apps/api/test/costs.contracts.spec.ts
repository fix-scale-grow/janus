import { describe, expect, it } from "bun:test";
import { costCreateInput } from "../src/costs/costs.contracts";

describe("costCreateInput", () => {
	it("accepts a well-formed cost", () => {
		const result = costCreateInput.safeParse({
			dealId: "deal_1",
			date: new Date().toISOString(),
			amountCents: 500,
			category: "MATERIALS",
		});

		expect(result.success).toBe(true);
	});

	it("gives one human message for an amount far past the cap", () => {
		const result = costCreateInput.safeParse({
			dealId: "deal_1",
			date: new Date().toISOString(),
			amountCents: 99_999_999_999,
			category: "MATERIALS",
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		const messages = new Set(result.error.issues.map((issue) => issue.message));
		expect(messages).toEqual(new Set(["That amount is too large to record."]));
	});
});
