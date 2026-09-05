import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { TEMPLATE_BLOCKS } from "./templates.config";

function decodeHrefEntities(value: string): string {
	return value
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, dec: string) =>
			String.fromCharCode(Number.parseInt(dec, 10)),
		)
		.replace(/&amp;/gi, "&")
		.replace(/&colon;/gi, ":")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&apos;/gi, "'");
}

function stripControlCharacters(value: string): string {
	let result = "";
	for (const char of value) {
		const code = char.charCodeAt(0);
		if (code > 0x20 && code !== 0x7f) result += char;
	}
	return result;
}

function isAllowedHref(href: string): boolean {
	const normalized = stripControlCharacters(
		decodeHrefEntities(href),
	).toLowerCase();

	return TEMPLATE_BLOCKS.text.allowedHrefSchemes.some((scheme) =>
		normalized.startsWith(scheme),
	);
}

function sanitizeHtml(html: string): string {
	const withoutScripts = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

	return withoutScripts.replace(
		/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
		(match, tag: string, attrs: string) => {
			const kind = tag.toLowerCase();
			if (
				!(TEMPLATE_BLOCKS.text.allowedTags as readonly string[]).includes(kind)
			) {
				return "";
			}

			if (match.startsWith("</")) return `</${kind}>`;

			if (kind === "a") {
				const hrefMatch = attrs.match(
					/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i,
				);
				const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2]) : undefined;
				if (href && isAllowedHref(href)) {
					return `<a href="${href}">`;
				}
				return "<a>";
			}

			if (kind === "span") {
				const fieldMatch = attrs.match(
					/data-field\s*=\s*"([^"]*)"|data-field\s*=\s*'([^']*)'/i,
				);
				const dataField = fieldMatch
					? (fieldMatch[1] ?? fieldMatch[2])
					: undefined;
				if (dataField) return `<span data-field="${dataField}">`;
				return "<span>";
			}

			return `<${kind}>`;
		},
	);
}

export const templateBlockSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("heading"),
		text: z.string().max(TEMPLATE_BLOCKS.heading.maxTextLength),
	}),
	z.object({
		kind: z.literal("text"),
		html: z
			.string()
			.max(TEMPLATE_BLOCKS.text.maxHtmlLength)
			.transform(sanitizeHtml),
	}),
	z.object({
		kind: z.literal("button"),
		label: z.string().max(TEMPLATE_BLOCKS.button.maxLabelLength),
	}),
	z.object({ kind: z.literal("logo") }),
	z.object({ kind: z.literal("divider") }),
	z.object({
		kind: z.literal("spacer"),
		height: z
			.number()
			.int()
			.min(TEMPLATE_BLOCKS.spacer.minHeight)
			.max(TEMPLATE_BLOCKS.spacer.maxHeight),
	}),
]);

export type TemplateBlock = z.infer<typeof templateBlockSchema>;

export const templateBlocksSchema = z.array(templateBlockSchema).min(1);

export type TemplateBlocks = z.infer<typeof templateBlocksSchema>;

export function parseTemplateBlocks(value: unknown): TemplateBlocks {
	const parsed = templateBlocksSchema.safeParse(value);
	if (parsed.success) return parsed.data;

	throw new BadRequestException(
		parsed.error.issues
			.map((issue) => `${issue.path.join(".") || "blocks"} ${issue.message}`)
			.join("; "),
	);
}
