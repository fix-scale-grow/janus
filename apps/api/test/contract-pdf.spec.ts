import { describe, expect, it } from "bun:test";
import { renderContractPdf } from "../src/contracts/contract-pdf";
import type { TemplateBlocks } from "../src/templates/template-blocks";

const BODY_BLOCKS: TemplateBlocks = [
	{ kind: "heading", text: "Roofing Services Agreement" },
	{
		kind: "text",
		html: "This agreement is between {{business.name}} and {{contact.full_name}}.",
	},
	{ kind: "divider" },
];

function fixture() {
	return {
		title: "Smith residence agreement",
		number: 7,
		bodyHtmlBlocks: BODY_BLOCKS,
		context: {
			"business.name": "Acme Roofing",
			"contact.full_name": "Jane Smith",
		},
	};
}

describe("renderContractPdf", () => {
	it("returns a non-empty buffer starting with the PDF signature", async () => {
		const buffer = await renderContractPdf(fixture(), "Acme Roofing");

		expect(buffer.length).toBeGreaterThan(0);
		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("renders a typed signature", async () => {
		const buffer = await renderContractPdf(
			{
				...fixture(),
				signature: {
					kind: "typed",
					data: "Jane Smith",
					signerName: "Jane Smith",
					signedAt: new Date("2026-02-01T00:00:00Z"),
				},
			},
			"Acme Roofing",
		);

		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("renders without a signature", async () => {
		const buffer = await renderContractPdf(fixture(), "Acme Roofing");
		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("renders signature and page break blocks with chrome text", async () => {
		const buffer = await renderContractPdf(
			{
				...fixture(),
				bodyHtmlBlocks: [
					{ kind: "heading", text: "Terms" },
					{ kind: "text", html: "First page terms." },
					{ kind: "pageBreak" },
					{ kind: "text", html: "Second page terms." },
					{ kind: "signature" },
				],
				accentColor: "#aa3311",
				chrome: {
					headerBlocks: [
						{ kind: "heading", text: "{{business.name}}" },
						{ kind: "text", html: "AL Lic #12345" },
					],
					footerBlocks: [{ kind: "text", html: "(555) 123-4567" }],
				},
				signature: {
					kind: "typed",
					data: "Jane Smith",
					signerName: "Jane Smith",
					signedAt: new Date("2026-02-01T00:00:00Z"),
				},
			},
			"Acme Roofing",
		);

		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});
});
