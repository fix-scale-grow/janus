import { describe, expect, it } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import {
	assertMergeComplete,
	collectTokens,
	type MissingMerge,
	missingMerges,
} from "../src/templates/merge-guard";
import type { TemplateBlocks } from "../src/templates/template-blocks";

const BLOCKS: TemplateBlocks = [
	{ kind: "heading", text: "Hi {{contact.first_name}}" },
	{
		kind: "text",
		html: "Job at {{deal.address}} for {{estimate.total}}. {{personal_note}}",
	},
	{ kind: "button", label: "Sign at {{signing_link}}" },
	{ kind: "divider" },
	{ kind: "spacer", height: 16 },
	{ kind: "logo" },
];

describe("collectTokens", () => {
	it("scans the subject and every block's text/html/label", () => {
		const tokens = collectTokens("Your job {{deal.title}}", BLOCKS);

		expect(tokens).toContain("deal.title");
		expect(tokens).toContain("contact.first_name");
		expect(tokens).toContain("deal.address");
		expect(tokens).toContain("estimate.total");
		expect(tokens).toContain("personal_note");
		expect(tokens).toContain("signing_link");
	});

	it("dedupes a token that repeats across blocks", () => {
		const blocks: TemplateBlocks = [
			{ kind: "heading", text: "{{contact.first_name}}" },
			{ kind: "text", html: "{{contact.first_name}} again" },
		];

		const tokens = collectTokens("", blocks);

		expect(
			tokens.filter((token) => token === "contact.first_name"),
		).toHaveLength(1);
	});

	it("ignores blocks with no merge-carrying text", () => {
		const blocks: TemplateBlocks = [
			{ kind: "divider" },
			{ kind: "spacer", height: 8 },
			{ kind: "logo" },
		];

		expect(collectTokens("", blocks)).toEqual([]);
	});
});

describe("missingMerges", () => {
	const registry = new Map<string, string>([
		["contact.full_name", "Full name"],
		["deal.address", "Job address"],
		["signing_link", "Signing link"],
		["personal_note", "Personal note"],
		["contact.field.roof_type", "Roof type"],
	]);

	it("reports a known token with no value in context as empty", () => {
		const result = missingMerges(["contact.full_name"], {}, registry);

		expect(result).toEqual<MissingMerge[]>([
			{ token: "contact.full_name", label: "Full name", reason: "empty" },
		]);
	});

	it("reports a known static token with an empty-string value as empty", () => {
		const result = missingMerges(
			["deal.address"],
			{ "deal.address": "" },
			registry,
		);

		expect(result).toEqual<MissingMerge[]>([
			{ token: "deal.address", label: "Job address", reason: "empty" },
		]);
	});

	it("reports a live field token with no value as empty", () => {
		const result = missingMerges(["contact.field.roof_type"], {}, registry);

		expect(result).toEqual<MissingMerge[]>([
			{
				token: "contact.field.roof_type",
				label: "Roof type",
				reason: "empty",
			},
		]);
	});

	it("reports a token absent from the registry as unknown", () => {
		const result = missingMerges(
			["contact.field.archived_thing"],
			{},
			registry,
		);

		expect(result).toEqual<MissingMerge[]>([
			{
				token: "contact.field.archived_thing",
				label: "contact.field.archived_thing",
				reason: "unknown",
			},
		]);
	});

	it("never reports personal_note, empty or unknown", () => {
		expect(missingMerges(["personal_note"], {}, registry)).toEqual([]);
		expect(missingMerges(["personal_note"], {}, new Map())).toEqual([]);
	});

	it("does not report a token with a real value", () => {
		const result = missingMerges(
			["signing_link"],
			{ signing_link: "https://app.example.com/sign/abc" },
			registry,
		);

		expect(result).toEqual([]);
	});
});

describe("assertMergeComplete", () => {
	it("comma-space joins multiple unknown labels in the message", () => {
		const missing: MissingMerge[] = [
			{ token: "a", label: "Roof type", reason: "unknown" },
			{ token: "b", label: "Old field", reason: "unknown" },
		];

		let caught: unknown;
		try {
			assertMergeComplete("estimate", missing);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
		expect((caught as BadRequestException).message).toBe(
			"No longer exists — remove from the template: Roof type, Old field",
		);
	});

	it("comma-space joins multiple empty labels in the message", () => {
		const missing: MissingMerge[] = [
			{ token: "a", label: "Full name", reason: "empty" },
			{ token: "b", label: "Job address", reason: "empty" },
		];

		let caught: unknown;
		try {
			assertMergeComplete("estimate", missing);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
		expect((caught as BadRequestException).message).toBe(
			"Missing for this estimate: Full name, Job address",
		);
	});

	it("does not throw when nothing is missing", () => {
		expect(() => assertMergeComplete("estimate", [])).not.toThrow();
	});
});
