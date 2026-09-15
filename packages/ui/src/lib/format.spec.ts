import { describe, expect, test } from "bun:test";
import { formatUsd, formatUsdCompact, usdSymbol } from "./format";

describe("formatUsd", () => {
	test("formats whole dollars with no cents", () => {
		expect(formatUsd(150_000)).toBe("$1,500");
	});

	test("keeps cents when the amount is not whole", () => {
		expect(formatUsd(150_050)).toBe("$1,500.50");
	});
});

describe("formatUsdCompact", () => {
	test("compacts large amounts", () => {
		expect(formatUsdCompact(123_456_700)).toBe("$1.2M");
	});
});

describe("usdSymbol", () => {
	test("is the dollar sign", () => {
		expect(usdSymbol()).toBe("$");
	});
});
