import { describe, expect, it } from "bun:test";
import {
	applyMergeFields,
	renderEmailHtml,
} from "../src/templates/render-email";
import type { TemplateBlocks } from "../src/templates/template-blocks";

const CONTEXT: Record<string, string> = {
	"contact.first_name": "Jane",
	"business.name": "Acme Roofing Co",
};

describe("applyMergeFields", () => {
	it("substitutes a known token", () => {
		expect(applyMergeFields("Hi {{contact.first_name}}", CONTEXT)).toBe(
			"Hi Jane",
		);
	});

	it("replaces an unknown or missing token with an empty string", () => {
		expect(applyMergeFields("Hi {{contact.unknown_field}}", CONTEXT)).toBe(
			"Hi ",
		);
		expect(applyMergeFields("Note: {{personal_note}}", CONTEXT)).toBe("Note: ");
	});

	it("tolerates extra whitespace inside the braces", () => {
		expect(applyMergeFields("Hi {{  contact.first_name  }}", CONTEXT)).toBe(
			"Hi Jane",
		);
	});
});

describe("renderEmailHtml", () => {
	it("renders a heading block as an h2 with a 20px font size", () => {
		const blocks: TemplateBlocks = [{ kind: "heading", text: "Hello there" }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("<h2");
		expect(html).toContain("font-size:20px");
		expect(html).toContain("Hello there");
	});

	it("renders a text block, passing sanitized html through as-is", () => {
		const blocks: TemplateBlocks = [
			{ kind: "text", html: "<b>Hi</b> {{contact.first_name}}" },
		];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("<b>Hi</b> Jane");
	});

	it("renders a button block with the bulletproof button styling", () => {
		const blocks: TemplateBlocks = [{ kind: "button", label: "View estimate" }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("#006b4f");
		expect(html).toContain("border-radius:5px");
		expect(html).toContain("color:#ffffff");
		expect(html).toContain("padding:12px 24px");
		expect(html).toContain("View estimate");
	});

	it("renders a divider block", () => {
		const blocks: TemplateBlocks = [{ kind: "divider" }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("<hr");
	});

	it("renders a spacer block at the given height", () => {
		const blocks: TemplateBlocks = [{ kind: "spacer", height: 32 }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("32px");
	});

	it("renders a logo block with 44px rounded initials from business.name", () => {
		const blocks: TemplateBlocks = [{ kind: "logo" }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("44px");
		expect(html).toContain("border-radius");
		expect(html).toContain("AR");
	});

	it("substitutes merge fields inside a heading", () => {
		const blocks: TemplateBlocks = [
			{ kind: "heading", text: "Hi {{contact.first_name}}" },
		];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("Hi Jane");
	});

	it("renders an empty string for a missing token", () => {
		const blocks: TemplateBlocks = [
			{ kind: "heading", text: "Hi {{contact.unknown_field}}" },
		];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("<h2");
		expect(html).not.toContain("{{contact.unknown_field}}");
	});

	it("never emits a script tag even if a token value carries one", () => {
		const blocks: TemplateBlocks = [
			{ kind: "heading", text: "Hi {{contact.first_name}}" },
		];
		const { html } = renderEmailHtml(blocks, {
			"contact.first_name": "<script>alert(1)</script>",
		});

		expect(html).not.toContain("<script>");
	});

	it("wraps the content in a table-based 600px layout", () => {
		const blocks: TemplateBlocks = [{ kind: "heading", text: "Hi" }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("<table");
		expect(html).toContain("600px");
		expect(html).toContain("padding:24px 32px");
	});

	it("escapes a merge value substituted into a text block's html, but keeps raw text output", () => {
		const blocks: TemplateBlocks = [
			{ kind: "text", html: "Hi {{contact.full_name}}, welcome." },
		];
		const hostileContext = {
			"contact.full_name": "<img src=x onerror=alert(1)>",
		};

		const { html, text } = renderEmailHtml(blocks, hostileContext);

		expect(html).not.toContain("<img");
		expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
		expect(text).toContain("<img src=x onerror=alert(1)>");
	});

	it("attribute-escapes a hostile signing_link before it reaches the button href", () => {
		const blocks: TemplateBlocks = [
			{ kind: "button", label: "Review and sign" },
		];
		const hostileContext = {
			signing_link: '"><script>alert(1)</script>',
		};

		const { html } = renderEmailHtml(blocks, hostileContext);

		expect(html).not.toContain('href="">');
		expect(html).toContain('href="&quot;>');
	});

	it("renders a plain white 640px page in document mode, with no grey email shell", () => {
		const blocks: TemplateBlocks = [
			{ kind: "heading", text: "Roofing Services Agreement" },
		];
		const { html } = renderEmailHtml(blocks, CONTEXT, "document");

		expect(html).toContain("640px");
		expect(html).not.toContain("600px");
		expect(html).not.toContain("#f4f4f4");
	});

	it("renders a button block without the bulletproof table chrome in document mode", () => {
		const blocks: TemplateBlocks = [{ kind: "button", label: "Sign now" }];
		const { html } = renderEmailHtml(blocks, CONTEXT, "document");

		expect(html).not.toContain(
			'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:',
		);
		expect(html).toContain("Sign now");
		expect(html).toContain("#006b4f");
	});

	it("defaults to email mode when no mode is given", () => {
		const blocks: TemplateBlocks = [{ kind: "heading", text: "Hi" }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("600px");
		expect(html).toContain("#f4f4f4");
	});

	it("produces a plain-text variant with tags stripped", () => {
		const blocks: TemplateBlocks = [
			{ kind: "heading", text: "Hello there" },
			{ kind: "text", html: "<b>Hi</b> {{contact.first_name}}, welcome." },
			{ kind: "button", label: "View estimate" },
		];
		const { text } = renderEmailHtml(blocks, CONTEXT);

		expect(text).not.toContain("<");
		expect(text).not.toContain(">");
		expect(text).toContain("Hello there");
		expect(text).toContain("Hi Jane, welcome.");
		expect(text).toContain("View estimate");
	});
});
