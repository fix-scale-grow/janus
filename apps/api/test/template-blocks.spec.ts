import { describe, expect, it } from "bun:test";
import {
	parseTemplateBlocks,
	type TemplateBlocks,
	templateBlocksSchema,
} from "../src/templates/template-blocks";
import {
	DEFAULT_TEMPLATES,
	MERGE_FIELDS,
	SAMPLE_MERGE_CONTEXT,
} from "../src/templates/templates.config";

describe("templateBlocksSchema", () => {
	it("round-trips a well-formed tree", () => {
		const blocks: TemplateBlocks = [
			{ kind: "logo" },
			{ kind: "heading", text: "Hello there" },
			{ kind: "text", html: "<b>Hi</b> {{contact.first_name}}" },
			{ kind: "button", label: "View estimate" },
			{ kind: "divider" },
			{ kind: "spacer", height: 24 },
		];

		const result = templateBlocksSchema.safeParse(blocks);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(blocks);
		}
	});

	it("rejects an unknown block kind", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "video", url: "x" },
		]);

		expect(result.success).toBe(false);
	});

	it("rejects an empty tree", () => {
		const result = templateBlocksSchema.safeParse([]);

		expect(result.success).toBe(false);
	});

	it("rejects a spacer height below 4", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "spacer", height: 3 },
		]);

		expect(result.success).toBe(false);
	});

	it("rejects a spacer height above 96", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "spacer", height: 97 },
		]);

		expect(result.success).toBe(false);
	});

	it("accepts spacer heights at the boundary", () => {
		const min = templateBlocksSchema.safeParse([{ kind: "spacer", height: 4 }]);
		const max = templateBlocksSchema.safeParse([
			{ kind: "spacer", height: 96 },
		]);

		expect(min.success).toBe(true);
		expect(max.success).toBe(true);
	});

	it("strips a script tag out of text.html", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: "<script>alert(1)</script>Hi there" },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			expect(block?.kind).toBe("text");
			if (block?.kind === "text") {
				expect(block.html).not.toContain("<script>");
				expect(block.html).not.toContain("alert(1)");
				expect(block.html).toContain("Hi there");
			}
		}
	});

	it("strips a disallowed tag but keeps its text", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<div onclick="evil()">Hi there</div>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).not.toContain("<div");
				expect(block.html).not.toContain("onclick");
				expect(block.html).toContain("Hi there");
			}
		}
	});

	it("strips attributes off allowed tags except href on a and data-field on span", () => {
		const result = templateBlocksSchema.safeParse([
			{
				kind: "text",
				html: '<a href="https://example.com" onclick="evil()">Link</a> <span data-field="x" style="color:red">Field</span> <b class="x">Bold</b>',
			},
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).toContain('<a href="https://example.com">Link</a>');
				expect(block.html).toContain('<span data-field="x">Field</span>');
				expect(block.html).toContain("<b>Bold</b>");
				expect(block.html).not.toContain("onclick");
				expect(block.html).not.toContain("style=");
				expect(block.html).not.toContain('class="x"');
			}
		}
	});

	it("strips a javascript: href", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<a href="javascript:alert(1)">Link</a>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).not.toContain("javascript:");
			}
		}
	});

	it("strips a javascript: href hidden with a tab inside the scheme", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<a href="java\tscript:alert(1)">Link</a>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).not.toContain("href=");
			}
		}
	});

	it("strips a javascript: href hidden with a newline inside the scheme", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<a href="java\nscript:alert(1)">Link</a>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).not.toContain("href=");
			}
		}
	});

	it("strips a javascript: href hidden with decimal HTML entities", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<a href="&#106;avascript&#58;alert(1)">Link</a>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).not.toContain("href=");
			}
		}
	});

	it("strips a javascript: href hidden with hex HTML entities", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<a href="javascript&#x3A;alert(1)">Link</a>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).not.toContain("href=");
			}
		}
	});

	it("keeps a plain https href", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<a href="https://example.com/path">Link</a>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).toContain('<a href="https://example.com/path">');
			}
		}
	});

	it("keeps a plain mailto href", () => {
		const result = templateBlocksSchema.safeParse([
			{ kind: "text", html: '<a href="mailto:jane@example.com">Link</a>' },
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).toContain('<a href="mailto:jane@example.com">');
			}
		}
	});

	it("escapes a double quote smuggled through a single-quoted href, defeating attribute breakout", () => {
		const result = templateBlocksSchema.safeParse([
			{
				kind: "text",
				html: `<a href='https://x" onmouseover="alert(1)'>Link</a>`,
			},
		]);

		expect(result.success).toBe(true);
		if (result.success) {
			const [block] = result.data;
			if (block?.kind === "text") {
				expect(block.html).toContain(
					'<a href="https://x&quot; onmouseover=&quot;alert(1)">',
				);
				expect(block.html).not.toContain('x" onmouseover="alert(1)');
			}
		}
	});

	it("is idempotent when sanitizing an already-escaped attribute a second time", () => {
		const first = templateBlocksSchema.safeParse([
			{
				kind: "text",
				html: `<a href='https://x" onmouseover="alert(1)'>Link</a>`,
			},
		]);

		expect(first.success).toBe(true);
		if (!first.success) return;
		const [firstBlock] = first.data;
		if (firstBlock?.kind !== "text") throw new Error("expected text block");

		const second = templateBlocksSchema.safeParse([
			{ kind: "text", html: firstBlock.html },
		]);

		expect(second.success).toBe(true);
		if (!second.success) return;
		const [secondBlock] = second.data;
		if (secondBlock?.kind !== "text") throw new Error("expected text block");

		expect(secondBlock.html).toBe(firstBlock.html);
		expect(secondBlock.html).not.toContain('x" onmouseover="alert(1)');
	});
});

describe("parseTemplateBlocks", () => {
	it("returns the parsed blocks for a valid tree", () => {
		const blocks = parseTemplateBlocks([{ kind: "heading", text: "Hi" }]);

		expect(blocks).toEqual([{ kind: "heading", text: "Hi" }]);
	});

	it("throws BadRequestException for an invalid tree", () => {
		expect(() => parseTemplateBlocks([])).toThrow();
		expect(() => parseTemplateBlocks("not a tree")).toThrow();
	});
});

describe("MERGE_FIELDS / SAMPLE_MERGE_CONTEXT", () => {
	it("has a sample value for every registered token", () => {
		const tokens = Object.values(MERGE_FIELDS).flat();

		for (const token of tokens) {
			expect(SAMPLE_MERGE_CONTEXT[token]).toBeDefined();
			expect(typeof SAMPLE_MERGE_CONTEXT[token]).toBe("string");
		}

		expect(tokens).toContain("signing_link");
		expect(tokens).toContain("personal_note");
	});
});

describe("DEFAULT_TEMPLATES", () => {
	it("seeds all four purposes with a parseable block tree", () => {
		for (const purpose of Object.keys(DEFAULT_TEMPLATES) as Array<
			keyof typeof DEFAULT_TEMPLATES
		>) {
			const template = DEFAULT_TEMPLATES[purpose];
			expect(() => parseTemplateBlocks(template.blocks)).not.toThrow();
			expect(template.name.length).toBeGreaterThan(0);
		}
	});

	it("mentions the attached PDF in the estimate and invoice emails", () => {
		const estimateHtml = JSON.stringify(DEFAULT_TEMPLATES.ESTIMATE_SEND.blocks);
		const invoiceHtml = JSON.stringify(DEFAULT_TEMPLATES.INVOICE_SEND.blocks);

		expect(estimateHtml).toContain("attached as a PDF");
		expect(invoiceHtml).toContain("attached as a PDF");
	});

	it("mentions the signing link in the contract email only", () => {
		const contractEmail = JSON.stringify(
			DEFAULT_TEMPLATES.CONTRACT_SEND.blocks,
		);

		expect(contractEmail).toContain("{{signing_link}}");
	});

	it("includes {{personal_note}} in all three email templates", () => {
		for (const purpose of [
			"ESTIMATE_SEND",
			"INVOICE_SEND",
			"CONTRACT_SEND",
		] as const) {
			const html = JSON.stringify(DEFAULT_TEMPLATES[purpose].blocks);
			expect(html).toContain("{{personal_note}}");
		}
	});

	it("does not include personal_note in the contract body", () => {
		const html = JSON.stringify(DEFAULT_TEMPLATES.CONTRACT_BODY.blocks);

		expect(html).not.toContain("{{personal_note}}");
	});

	it("uses the required contract body tokens", () => {
		const html = JSON.stringify(DEFAULT_TEMPLATES.CONTRACT_BODY.blocks);

		expect(html).toContain("{{business.name}}");
		expect(html).toContain("{{contact.full_name}}");
		expect(html).toContain("{{deal.address}}");
		expect(html).toContain("{{estimate.title}}");
		expect(html).toContain("{{estimate.total}}");
	});
});
