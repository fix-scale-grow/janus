import { appUrl, WORKSPACE_ID } from "@crm/auth";
import type { Db } from "@crm/db";
import { normalizeHex, readableForeground } from "@crm/db/brand";
import type { TemplateBlocks } from "./template-blocks";
import { EMAIL_RENDER } from "./templates.config";

export const MERGE_TOKEN_PATTERN = /{{\s*([\w.]+)\s*}}/g;

const { tableWidth: TABLE_WIDTH, cellPadding: CELL_PADDING } = EMAIL_RENDER;
const { logoSize: LOGO_SIZE } = EMAIL_RENDER;

export interface EmailBrand {
	color: string;
	foreground: string;
	logoUrl: string | null;
}

export function normalizeAppUrl(url: string): string {
	return url.replace(/\/+$/, "");
}

export async function resolveEmailBrand(db: Db): Promise<EmailBrand> {
	const row = await db.organization.findUnique({
		where: { id: WORKSPACE_ID },
		select: { brandColor: true, logo: true },
	});

	const color = normalizeHex(row?.brandColor) ?? EMAIL_RENDER.brandGreen;
	const baseUrl = normalizeAppUrl(appUrl);

	return {
		color,
		foreground: readableForeground(color),
		logoUrl: row?.logo ? `${baseUrl}${row.logo}` : null,
	};
}

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

export function buttonHref(context: Record<string, string>): string {
	for (const token of EMAIL_RENDER.buttonLinkTokens) {
		const link = context[token];
		if (link) return link;
	}
	return "#";
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

function renderRow(
	content: string,
	align?: "left" | "center" | "right",
): string {
	const alignStyle = align ? `text-align:${align};` : "";
	const alignAttr = align ? ` align="${align}"` : "";
	return `<tr><td${alignAttr} style="padding:${CELL_PADDING};${alignStyle}">${content}</td></tr>`;
}

const HEADING_SIZE_PX: Record<"sm" | "md" | "lg" | "xl", number> = {
	sm: 16,
	md: 20,
	lg: 28,
	xl: 36,
};

const LOGO_SIZE_PX: Record<"sm" | "md" | "lg" | "xl", number> = {
	sm: 32,
	md: 44,
	lg: 72,
	xl: 104,
};

function renderBlockHtml(
	block: TemplateBlocks[number],
	context: Record<string, string>,
	mode: RenderMode,
	brand: EmailBrand,
): string {
	switch (block.kind) {
		case "heading": {
			const text = escapeHtml(applyMergeFields(block.text, context));
			const size = HEADING_SIZE_PX[block.size ?? "md"];
			const color = block.color ?? "#111111";
			return renderRow(
				`<h2 style="margin:0;font-size:${size}px;line-height:1.3;color:${color};font-family:Arial,sans-serif;">${text}</h2>`,
				block.align,
			);
		}
		case "text": {
			const html = applyMergeFieldsHtml(block.html, context);
			const color = block.color ?? "#333333";
			return renderRow(
				`<div style="font-size:14px;line-height:1.5;color:${color};font-family:Arial,sans-serif;">${html}</div>`,
				block.align,
			);
		}
		case "button": {
			const label = escapeHtml(applyMergeFields(block.label, context));
			const href = escapeAttribute(buttonHref(context));
			const background = block.color ?? brand.color;
			if (mode === "document") {
				return renderRow(
					`<a href="${href}" style="display:inline-block;padding:12px 24px;background:${background};border-radius:5px;color:${brand.foreground};text-decoration:none;font-family:Arial,sans-serif;font-size:14px;">${label}</a>`,
				);
			}
			return renderRow(
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${background};border-radius:5px;" bgcolor="${background}"><a href="${href}" style="display:inline-block;padding:12px 24px;color:${brand.foreground};text-decoration:none;font-family:Arial,sans-serif;font-size:14px;">${label}</a></td></tr></table>`,
			);
		}
		case "divider": {
			const color = block.color ?? "#e5e5e5";
			return `<tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid ${color};margin:0;"></td></tr>`;
		}
		case "signature":
			if (mode !== "document") return "";
			return renderRow(
				`<div style="border:1px dashed #bbbbbb;border-radius:5px;padding:20px 24px;color:#666666;font-family:Arial,sans-serif;font-size:13px;">Signature<br><span style="font-size:11px;">Signed below when the contract is accepted.</span></div>`,
			);
		case "pageBreak":
			if (mode !== "document") return "";
			return `<tr><td style="padding:8px 32px;"><hr style="border:none;border-top:1px dashed #dddddd;margin:0;"></td></tr>`;
		case "columns": {
			const width = Math.floor(100 / block.columns.length);
			const cells = block.columns
				.map((column) => {
					const inner = column
						.map((child) => renderBlockHtml(child, context, mode, brand))
						.join("");
					return `<td valign="top" width="${width}%" style="vertical-align:top;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${inner}</table></td>`;
				})
				.join("");
			return `<tr><td style="padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cells}</tr></table></td></tr>`;
		}
		case "spacer":
			return `<tr><td style="padding:0;height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</td></tr>`;
		case "logo": {
			const logoSize = block.size ? LOGO_SIZE_PX[block.size] : LOGO_SIZE;
			const inlineWrap =
				block.align === "center" || block.align === "right"
					? "display:inline-block;"
					: "display:block;";
			if (brand.logoUrl) {
				const src = escapeAttribute(brand.logoUrl);
				return renderRow(
					`<img src="${src}" alt="" width="${logoSize}" height="${logoSize}" style="max-height:${logoSize}px;width:auto;${inlineWrap}">`,
					block.align,
				);
			}
			const initials = initialsFromBusinessName(context);
			return renderRow(
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${block.align === "center" ? "margin:0 auto;" : block.align === "right" ? "margin-left:auto;" : ""}"><tr><td width="${logoSize}" height="${logoSize}" style="width:${logoSize}px;height:${logoSize}px;border-radius:${logoSize / 2}px;background:${brand.color};color:${brand.foreground};text-align:center;vertical-align:middle;font-family:Arial,sans-serif;font-size:16px;" bgcolor="${brand.color}">${initials}</td></tr></table>`,
				block.align,
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
			const href = buttonHref(context);
			return `${label}: ${href}`;
		}
		case "divider":
			return "----------------------------------------";
		case "spacer":
			return "";
		case "logo":
			return "";
		case "signature":
			return "";
		case "pageBreak":
			return "";
		case "columns":
			return block.columns
				.map((column) =>
					column
						.map((child) => renderBlockText(child, context))
						.filter((line) => line.length > 0)
						.join("\n"),
				)
				.filter((part) => part.length > 0)
				.join("\n");
	}
}

export type RenderMode = "email" | "document";

const DOCUMENT_WIDTH = 640;

const DEFAULT_BRAND: EmailBrand = {
	color: EMAIL_RENDER.brandGreen,
	foreground: "#ffffff",
	logoUrl: null,
};

export function renderEmailHtml(
	blocks: TemplateBlocks,
	context: Record<string, string>,
	mode: RenderMode = "email",
	brand: EmailBrand = DEFAULT_BRAND,
): { html: string; text: string } {
	const rows = blocks
		.map((block) => renderBlockHtml(block, context, mode, brand))
		.join("");

	const width = mode === "document" ? DOCUMENT_WIDTH : TABLE_WIDTH;
	const outerBackground = mode === "document" ? "#ffffff" : "#f4f4f4";

	const html =
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${outerBackground};">` +
		`<tr><td align="center" style="padding:24px 0;">` +
		(mode === "document"
			? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${width}px;background:#ffffff;">`
			: `<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="width:${width}px;max-width:${width}px;background:#ffffff;">`) +
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
