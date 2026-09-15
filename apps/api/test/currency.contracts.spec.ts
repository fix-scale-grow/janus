import { describe, expect, it } from "bun:test";
import { setReportingCurrencyInput } from "../src/currency/currency.contracts";

describe("setReportingCurrencyInput", () => {
	it("accepts USD", () => {
		const result = setReportingCurrencyInput.safeParse({ currency: "USD" });

		expect(result.success).toBe(true);
	});

	it("rejects a non-USD currency with a clear message", () => {
		const result = setReportingCurrencyInput.safeParse({ currency: "EUR" });

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map((issue) => issue.message)).toEqual([
			"The reporting currency is USD.",
		]);
	});
});
