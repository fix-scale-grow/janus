import { describe, expect, it } from "bun:test";
import { isQuestionShaped } from "./ask-detect";

describe("isQuestionShaped", () => {
	it("detects a trailing question mark", () => {
		expect(isQuestionShaped("what is the deal stage?")).toBe(true);
	});

	it("detects a question word with no question mark", () => {
		expect(isQuestionShaped("who owns this deal")).toBe(true);
	});

	it("is case insensitive on the first word", () => {
		expect(isQuestionShaped("WHICH jobs are stalled")).toBe(true);
	});

	it("recognizes every question word", () => {
		const words = [
			"who",
			"what",
			"which",
			"when",
			"why",
			"how",
			"should",
			"can",
			"is",
			"are",
			"do",
			"does",
		];
		for (const word of words) {
			expect(isQuestionShaped(`${word} this is a job`)).toBe(true);
		}
	});

	it("returns false for a plain search term", () => {
		expect(isQuestionShaped("acme roofing")).toBe(false);
	});

	it("returns false for an empty string", () => {
		expect(isQuestionShaped("")).toBe(false);
	});

	it("returns false for whitespace only", () => {
		expect(isQuestionShaped("   ")).toBe(false);
	});

	it("returns false for digits", () => {
		expect(isQuestionShaped("4470")).toBe(false);
	});

	it("returns false for a single non-question word", () => {
		expect(isQuestionShaped("roofing")).toBe(false);
	});

	it("treats a single question word alone as question shaped", () => {
		expect(isQuestionShaped("how")).toBe(true);
	});

	it("ignores leading whitespace before the first word", () => {
		expect(isQuestionShaped("  how many jobs are open")).toBe(true);
	});
});
