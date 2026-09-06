import { badgeVariants } from "@crm/ui/components/badge";
import { mergeFieldLabel, TEMPLATE_BLOCKS } from "./merge-fields";

const FIELD_TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const FIELD_SPAN =
	/<span[^>]*\sdata-field="([a-zA-Z0-9_.]+)"[^>]*>[\s\S]*?<\/span>/g;
const HTML_TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
const SCRIPT_TAG = /<script[^>]*>[\s\S]*?<\/script>/gi;
const HREF_ATTRIBUTE = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i;
const FIELD_ATTRIBUTE =
	/data-field\s*=\s*"([^"]*)"|data-field\s*=\s*'([^']*)'/i;
const ZERO_WIDTH = /[\u200b\u200c\ufeff]/g;
const SPACER_CHARACTER = String.fromCharCode(160);

const BLOCK_TAGS = ["div", "p", "li", "ul", "ol", "h1", "h2", "h3"];
const CHIP_CLASS = badgeVariants({ variant: "field" });

function escapeText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, "&quot;");
}

function decodeAttribute(value: string): string {
	return value
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#0*39;/g, "'")
		.replace(/&apos;/gi, "'")
		.replace(/&amp;/gi, "&");
}

function reescapeAttribute(value: string): string {
	return escapeAttribute(decodeAttribute(value));
}

function isAllowedHref(href: string): boolean {
	const normalized = href.trim().toLowerCase();
	return TEMPLATE_BLOCKS.text.allowedHrefSchemes.some((scheme) =>
		normalized.startsWith(scheme),
	);
}

function isAllowedTag(tag: string): boolean {
	return (TEMPLATE_BLOCKS.text.allowedTags as readonly string[]).includes(tag);
}

function sanitizeStoredHtml(html: string): string {
	return html
		.replace(SCRIPT_TAG, "")
		.replace(HTML_TAG, (match, rawTag: string, attributes: string) => {
			const tag = rawTag.toLowerCase();
			if (!isAllowedTag(tag)) return "";
			if (match.startsWith("</")) return `</${tag}>`;

			if (tag === "a") {
				const found = attributes.match(HREF_ATTRIBUTE);
				const href = found ? (found[1] ?? found[2]) : undefined;
				if (href && isAllowedHref(href)) {
					return `<a href="${reescapeAttribute(href)}">`;
				}
				return "<a>";
			}

			if (tag === "span") {
				const found = attributes.match(FIELD_ATTRIBUTE);
				const field = found ? (found[1] ?? found[2]) : undefined;
				if (field) return `<span data-field="${reescapeAttribute(field)}">`;
				return "<span>";
			}

			return `<${tag}>`;
		});
}

export function fieldChipHtml(token: string): string {
	return `<span class="${escapeAttribute(CHIP_CLASS)}" data-field="${escapeAttribute(token)}" contenteditable="false">${escapeText(mergeFieldLabel(token))}</span>`;
}

export function toEditorHtml(html: string): string {
	return sanitizeStoredHtml(html)
		.replace(FIELD_SPAN, (_match, token: string) => `{{${token}}}`)
		.replace(FIELD_TOKEN, (_match, token: string) => fieldChipHtml(token));
}

export function toEditorText(text: string): string {
	return escapeText(text).replace(FIELD_TOKEN, (_match, token: string) =>
		fieldChipHtml(token),
	);
}

type SerializeMode = "html" | "text";

function isEmptyLine(node: HTMLElement): boolean {
	const only = node.childNodes.length === 1 ? node.firstChild : null;
	return only instanceof HTMLElement && only.tagName === "BR";
}

function serializeNode(
	node: Node,
	mode: SerializeMode,
	first: boolean,
): string {
	if (node instanceof Text) {
		const value = (node.textContent ?? "").replace(ZERO_WIDTH, "");
		return mode === "html" ? escapeText(value) : value;
	}

	if (!(node instanceof HTMLElement)) return "";

	const field = node.dataset.field;
	if (field) {
		return mode === "html"
			? `<span data-field="${escapeAttribute(field)}">{{${field}}}</span>`
			: `{{${field}}}`;
	}

	const tag = node.tagName.toLowerCase();
	if (tag === "br") return mode === "html" ? "<br>" : "\n";

	if (BLOCK_TAGS.includes(tag)) {
		const inner = isEmptyLine(node) ? "" : serializeChildren(node, mode);
		if (first) return inner;
		return mode === "html" ? `<br>${inner}` : `\n${inner}`;
	}

	const inner = serializeChildren(node, mode);

	if (mode === "text") return inner;

	if (tag === "a") {
		const href = node.getAttribute("href");
		if (href && isAllowedHref(href)) {
			return `<a href="${escapeAttribute(href)}">${inner}</a>`;
		}
		return `<a>${inner}</a>`;
	}

	if (isAllowedTag(tag)) return `<${tag}>${inner}</${tag}>`;

	return inner;
}

function serializeChildren(root: Node, mode: SerializeMode): string {
	let output = "";
	let index = 0;

	for (const child of Array.from(root.childNodes)) {
		output += serializeNode(child, mode, index === 0);
		index += 1;
	}

	return output;
}

export function serializeBlockHtml(root: HTMLElement): string {
	return serializeChildren(root, "html").trim();
}

export function serializeBlockText(root: HTMLElement): string {
	return serializeChildren(root, "text").replace(/\s+/g, " ").trim();
}

function currentSelection(): Selection | null {
	return typeof document === "undefined" ? null : document.getSelection();
}

function collapseAfter(node: Node): void {
	const selection = currentSelection();
	if (!selection) return;

	const range = document.createRange();
	range.setStartAfter(node);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}

export function createFieldChip(token: string): HTMLSpanElement {
	const chip = document.createElement("span");
	chip.className = CHIP_CLASS;
	chip.dataset.field = token;
	chip.contentEditable = "false";
	chip.textContent = mergeFieldLabel(token);
	return chip;
}

export function rangeWithin(root: HTMLElement): Range | null {
	const selection = currentSelection();
	if (!selection || selection.rangeCount === 0) return null;

	const range = selection.getRangeAt(0);
	if (!root.contains(range.commonAncestorContainer)) return null;

	return range.cloneRange();
}

export function insertFieldChip(
	root: HTMLElement,
	range: Range | null,
	token: string,
): void {
	const chip = createFieldChip(token);
	const spacer = document.createTextNode(SPACER_CHARACTER);
	const target =
		range && root.contains(range.commonAncestorContainer) ? range : null;

	if (target) {
		target.deleteContents();
		target.insertNode(spacer);
		target.insertNode(chip);
	} else {
		root.append(chip, spacer);
	}

	root.focus();
	collapseAfter(spacer);
}

export function insertPlainText(root: HTMLElement, text: string): void {
	const node = document.createTextNode(text);
	const range = rangeWithin(root);

	if (range) {
		range.deleteContents();
		range.insertNode(node);
	} else {
		root.append(node);
	}

	collapseAfter(node);
}

function neighbourNode(range: Range, backwards: boolean): Node | null {
	const node = range.startContainer;
	const offset = range.startOffset;

	if (node instanceof Text) {
		if (backwards ? offset > 0 : offset < node.length) return null;
		return backwards ? node.previousSibling : node.nextSibling;
	}

	return backwards
		? (node.childNodes[offset - 1] ?? null)
		: (node.childNodes[offset] ?? null);
}

export function fieldChipBeside(
	range: Range,
	backwards: boolean,
): HTMLElement | null {
	if (!range.collapsed) return null;

	const node = neighbourNode(range, backwards);
	if (node instanceof HTMLElement && node.dataset.field) return node;

	return null;
}
