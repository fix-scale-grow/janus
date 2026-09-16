import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import type { EmailBrand } from "../src/templates/render-email";
import {
	applyMergeFields,
	normalizeAppUrl,
	renderEmailHtml,
	resolveEmailBrand,
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

	it("applies block colour, alignment and heading size", () => {
		const { html } = renderEmailHtml(
			[
				{
					kind: "heading",
					text: "Styled",
					align: "center",
					color: "#aa0011",
					size: "lg",
				},
				{ kind: "divider", color: "#00ff00" },
			],
			CONTEXT,
		);

		expect(html).toContain("font-size:28px");
		expect(html).toContain("color:#aa0011");
		expect(html).toContain("text-align:center");
		expect(html).toContain("#00ff00");
	});

	it("renders columns side by side as table cells", () => {
		const { html, text } = renderEmailHtml(
			[
				{
					kind: "columns",
					columns: [
						[{ kind: "heading", text: "Left side" }],
						[{ kind: "text", html: "Right side" }],
					],
				},
			],
			CONTEXT,
		);

		expect(html).toContain('width="50%"');
		expect(html).toContain("Left side");
		expect(html).toContain("Right side");
		expect(text).toContain("Left side");
		expect(text).toContain("Right side");
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

	it("links the button at the proposal when there is no signing link", () => {
		const blocks: TemplateBlocks = [
			{ kind: "button", label: "View your proposal" },
		];
		const context = {
			proposal_link: "https://crm.example.com/proposal/abc123",
		};

		const { html, text } = renderEmailHtml(blocks, context);

		expect(html).toContain('href="https://crm.example.com/proposal/abc123"');
		expect(html).not.toContain('href="#"');
		expect(text).toContain("https://crm.example.com/proposal/abc123");
	});

	it("prefers the signing link when a message carries both links", () => {
		const blocks: TemplateBlocks = [{ kind: "button", label: "Sign" }];
		const context = {
			signing_link: "https://crm.example.com/sign/abc123",
			proposal_link: "https://crm.example.com/proposal/abc123",
		};

		const { html } = renderEmailHtml(blocks, context);

		expect(html).toContain('href="https://crm.example.com/sign/abc123"');
	});

	it("fits a document to the screen it is read on", () => {
		const { html } = renderEmailHtml(
			[{ kind: "text", html: "A long contract paragraph." }],
			CONTEXT,
			"document",
		);

		expect(html).toContain("max-width:640px");
		expect(html).toContain("width:100%");
		expect(html).not.toContain('style="width:640px');
		expect(html).not.toContain('width="640"');
	});

	it("keeps the fixed 600px table Outlook needs for an email", () => {
		const { html } = renderEmailHtml(
			[{ kind: "text", html: "A long email paragraph." }],
			CONTEXT,
		);

		expect(html).toContain('width="600"');
		expect(html).toContain("width:600px;max-width:600px");
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

describe("renderEmailHtml brand", () => {
	const darkBrand: EmailBrand = {
		color: "#1a1a1a",
		foreground: "#ffffff",
		logoUrl: null,
	};

	const paleBrand: EmailBrand = {
		color: "#fffbe6",
		foreground: "#171717",
		logoUrl: null,
	};

	const logoBrand: EmailBrand = {
		color: "#006b4f",
		foreground: "#ffffff",
		logoUrl: "https://app.example.com/api/workspace/logo/file?v=123",
	};

	it("renders an <img> logo block with an absolute URL when logoUrl is given", () => {
		const blocks: TemplateBlocks = [{ kind: "logo" }];
		const { html } = renderEmailHtml(blocks, CONTEXT, "email", logoBrand);

		expect(html).toContain(
			'<img src="https://app.example.com/api/workspace/logo/file?v=123"',
		);
		expect(html).not.toContain("AR");
	});

	it("falls back to the initials circle when logoUrl is absent", () => {
		const blocks: TemplateBlocks = [{ kind: "logo" }];
		const { html } = renderEmailHtml(blocks, CONTEXT, "email", darkBrand);

		expect(html).not.toContain("<img");
		expect(html).toContain("AR");
	});

	it("uses white text on a dark brand color for the button and initials circle", () => {
		const blocks: TemplateBlocks = [
			{ kind: "logo" },
			{ kind: "button", label: "Sign" },
		];
		const { html } = renderEmailHtml(blocks, CONTEXT, "email", darkBrand);

		expect(html).toContain("background:#1a1a1a");
		expect(html).toContain("color:#ffffff");
	});

	it("uses dark text on a pale brand color for the button and initials circle", () => {
		const blocks: TemplateBlocks = [
			{ kind: "logo" },
			{ kind: "button", label: "Sign" },
		];
		const { html } = renderEmailHtml(blocks, CONTEXT, "email", paleBrand);

		expect(html).toContain("background:#fffbe6");
		expect(html).toContain("color:#171717");
	});

	it("defaults to the standard green brand when no brand is given", () => {
		const blocks: TemplateBlocks = [{ kind: "button", label: "Sign" }];
		const { html } = renderEmailHtml(blocks, CONTEXT);

		expect(html).toContain("background:#006b4f");
		expect(html).toContain("color:#ffffff");
	});
});

describe("normalizeAppUrl", () => {
	it("strips a single trailing slash", () => {
		expect(normalizeAppUrl("https://app.example.com/")).toBe(
			"https://app.example.com",
		);
	});

	it("strips repeated trailing slashes", () => {
		expect(normalizeAppUrl("https://app.example.com///")).toBe(
			"https://app.example.com",
		);
	});

	it("leaves a URL with no trailing slash unchanged", () => {
		expect(normalizeAppUrl("https://app.example.com")).toBe(
			"https://app.example.com",
		);
	});
});

describe("resolveEmailBrand", () => {
	function fakeDb(row: { brandColor: string | null; logo: string | null }) {
		return {
			organization: {
				findUnique: async () => row,
			},
		} as unknown as Db;
	}

	it("returns a null logoUrl when the organization has no logo", async () => {
		const brand = await resolveEmailBrand(
			fakeDb({ brandColor: null, logo: null }),
		);

		expect(brand.logoUrl).toBeNull();
	});
});
