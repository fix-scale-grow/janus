import { describe, expect, it } from "bun:test";
import { dealCreateInput, dealUpdateInput } from "../src/deals/deals.contracts";

describe("dealCreateInput", () => {
	it("accepts USD", () => {
		const result = dealCreateInput.safeParse({
			name: "Domestic",
			ownerId: "user_1",
			currency: "USD",
		});

		expect(result.success).toBe(true);
	});

	it("accepts a deal with no currency given", () => {
		const result = dealCreateInput.safeParse({
			name: "Domestic",
			ownerId: "user_1",
		});

		expect(result.success).toBe(true);
	});

	it("rejects a non-USD currency", () => {
		const result = dealCreateInput.safeParse({
			name: "Continental",
			ownerId: "user_1",
			currency: "EUR",
		});

		expect(result.success).toBe(false);
	});
});

describe("dealUpdateInput", () => {
	it("rejects a non-USD currency", () => {
		const result = dealUpdateInput.safeParse({ currency: "CHF" });

		expect(result.success).toBe(false);
	});

	it("accepts USD", () => {
		const result = dealUpdateInput.safeParse({ currency: "USD" });

		expect(result.success).toBe(true);
	});
});
