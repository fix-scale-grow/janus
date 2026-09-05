import { describe, expect, it } from "bun:test";
import { quantityForUnit } from "../src/index";

describe("quantityForUnit", () => {
	it("maps area to squares for PER_SQUARE", () => {
		expect(
			quantityForUnit("PER_SQUARE", { areaSqFt: 14973.4, squares: 149.734 }),
		).toBe(149.73);
	});
	it("maps length to feet for PER_LINEAR_FT", () => {
		expect(quantityForUnit("PER_LINEAR_FT", { lengthFt: 163.456 })).toBe(
			163.46,
		);
	});
	it("maps count for PER_EACH", () => {
		expect(quantityForUnit("PER_EACH", { count: 5 })).toBe(5);
	});
	it("returns 1 for FLAT regardless of measurement", () => {
		expect(quantityForUnit("FLAT", null)).toBe(1);
	});
	it("returns null for unit/measurement mismatch", () => {
		expect(quantityForUnit("PER_SQUARE", { lengthFt: 10 })).toBeNull();
		expect(quantityForUnit("PER_LINEAR_FT", { count: 2 })).toBeNull();
		expect(
			quantityForUnit("PER_EACH", { areaSqFt: 5, squares: 0.05 }),
		).toBeNull();
	});
	it("returns null for missing measurement on measured units", () => {
		expect(quantityForUnit("PER_SQUARE", null)).toBeNull();
	});
});
