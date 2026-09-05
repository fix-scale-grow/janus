import type { TemplateBlocks } from "./template-blocks";
import { EMAIL_RENDER } from "./templates.config";

const MERGE_TOKEN_PATTERN = /{{\s*([\w.]+)\s*}}/g;

const { tableWidth: TABLE_WIDTH, cellPadding: CELL_PADDING } = EMAIL_RENDER;
const { brandGreen: BRAND_GREEN, logoSize: LOGO_SIZE } = EMAIL_RENDER;

export function applyMergeFields(
	input: string,
	context: Record<string, string>,
): string {
	return input.replace(MERGE_TOKEN_PATTERN, (_, token: string) => {
		return context[token] ?? "";
	});
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function applyMergeFieldsHtml(
	input: string,
	context: Record<string, string>,
): string {
	return input.replace(MERGE_TOKEN_PATTERN, (_, token: string) => {
		return escapeHtml(context[token] ?? "");
	});
}

function initialsFromBusinessName(context: Record<string, string>): string {
	const businessName = context["business.name"] ?? "";
	const words = businessName.trim().split(/\s+/).filter(Boolean);
	return words
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

function renderRow(content: string): string {
	return `<tr><td style="padding:${CELL_PADDING};">${content}</td></tr>`;
}

function renderBlockHtml(
	block: TemplateBlocks[number],
	context: Record<string, string>,
): string {
	switch (block.kind) {
		case "heading": {
			const text = escapeHtml(applyMergeFields(block.text, context));
			return renderRow(
				`<h2 style="margin:0;font-size:20px;line-height:1.3;color:#111111;font-family:Arial,sans-serif;">${text}</h2>`,
			);
		}
		case "text": {
			const html = applyMergeFieldsHtml(block.html, context);
			return renderRow(
				`<div style="font-size:14px;line-height:1.5;color:#333333;font-family:Arial,sans-serif;">${html}</div>`,
			);
		}
		case "button": {
			const label = escapeHtml(applyMergeFields(block.label, context));
			const href = escapeAttribute(context.signing_link ?? "#");
			return renderRow(
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${BRAND_GREEN};border-radius:5px;" bgcolor="${BRAND_GREEN}"><a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;">${label}</a></td></tr></table>`,
			);
		}
		case "divider":
			return `<tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e5e5;margin:0;"></td></tr>`;
		case "spacer":
			return `<tr><td style="padding:0;height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</td></tr>`;
		case "logo": {
			const initials = initialsFromBusinessName(context);
			return renderRow(
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="${LOGO_SIZE}" height="${LOGO_SIZE}" style="width:${LOGO_SIZE}px;height:${LOGO_SIZE}px;border-radius:${LOGO_SIZE / 2}px;background:${BRAND_GREEN};color:#ffffff;text-align:center;vertical-align:middle;font-family:Arial,sans-serif;font-size:16px;" bgcolor="${BRAND_GREEN}">${initials}</td></tr></table>`,
			);
		}
	}
}

function stripTags(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|h[1-6])>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.trim();
}

function renderBlockText(
	block: TemplateBlocks[number],
	context: Record<string, string>,
): string {
	switch (block.kind) {
		case "heading":
			return applyMergeFields(block.text, context);
		case "text":
			return applyMergeFields(stripTags(block.html), context);
		case "button": {
			const label = applyMergeFields(block.label, context);
			const href = context.signing_link ?? "#";
			return `${label}: ${href}`;
		}
		case "divider":
			return "----------------------------------------";
		case "spacer":
			return "";
		case "logo":
			return "";
	}
}

export function renderEmailHtml(
	blocks: TemplateBlocks,
	context: Record<string, string>,
): { html: string; text: string } {
	const rows = blocks.map((block) => renderBlockHtml(block, context)).join("");

	const html =
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;">` +
		`<tr><td align="center" style="padding:24px 0;">` +
		`<table role="presentation" width="${TABLE_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${TABLE_WIDTH}px;max-width:${TABLE_WIDTH}px;background:#ffffff;">` +
		rows +
		`</table>` +
		`</td></tr>` +
		`</table>`;

	const text = blocks
		.map((block) => renderBlockText(block, context))
		.filter((line) => line.length > 0)
		.join("\n\n");

	return { html, text };
}
