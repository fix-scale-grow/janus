import { describe, expect, test } from "bun:test";
import {
	BRAND_TOKEN_VARS,
	brandThemeCss,
	normalizeHex,
	readableForeground,
	relativeLuminance,
} from "./brand-theme";

describe("normalizeHex", () => {
	test("expands 3-digit shorthand", () => {
		expect(normalizeHex("#0b5")).toBe("#00bb55");
		expect(normalizeHex("abc")).toBe("#aabbcc");
	});

	test("normalizes case and optional leading hash", () => {
		expect(normalizeHex("#006B4F")).toBe("#006b4f");
		expect(normalizeHex("006B4F")).toBe("#006b4f");
		expect(normalizeHex("  #FFFFFF  ")).toBe("#ffffff");
	});

	test("rejects invalid input", () => {
		expect(normalizeHex(undefined)).toBeNull();
		expect(normalizeHex(null)).toBeNull();
		expect(normalizeHex("")).toBeNull();
		expect(normalizeHex("green")).toBeNull();
		expect(normalizeHex("#12")).toBeNull();
		expect(normalizeHex("#1234")).toBeNull();
		expect(normalizeHex("#gggggg")).toBeNull();
	});
});

describe("relativeLuminance", () => {
	test("black is 0 and white is 1", () => {
		expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
		expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
	});
});

describe("readableForeground", () => {
	test("dark brand color -> white text", () => {
		expect(readableForeground("#006b4f")).toBe("#ffffff");
		expect(readableForeground("#171717")).toBe("#ffffff");
	});

	test("light brand color -> near-black text", () => {
		expect(readableForeground("#ffd400")).toBe("#171717");
		expect(readableForeground("#ffffff")).toBe("#171717");
	});
});

describe("brandThemeCss", () => {
	test("returns empty string for no/invalid color (base tokens apply)", () => {
		expect(brandThemeCss()).toBe("");
		expect(brandThemeCss(null)).toBe("");
		expect(brandThemeCss("not-a-color")).toBe("");
	});

	test("overrides every brand token with a matching, readable pair", () => {
		const css = brandThemeCss("#c8102e"); // deep red -> white fg
		expect(css.startsWith(":root{")).toBe(true);
		expect(css.endsWith(";}")).toBe(true);
		for (const v of BRAND_TOKEN_VARS) {
			expect(css.includes(`${v}:`)).toBe(true);
		}
		expect(css).toContain("--primary:#c8102e");
		expect(css).toContain("--primary-foreground:#ffffff");
		expect(css).toContain("--sidebar-primary:#c8102e");
		expect(css).toContain("--ring:#c8102e");
	});

	test("light brand color gets dark foreground", () => {
		expect(brandThemeCss("#ffd400")).toContain("--primary-foreground:#171717");
	});

	test("normalizes shorthand and honors a custom selector", () => {
		const css = brandThemeCss("#0b5", { selector: ".janus-preview" });
		expect(css.startsWith(".janus-preview{")).toBe(true);
		expect(css).toContain("--primary:#00bb55");
	});
});
