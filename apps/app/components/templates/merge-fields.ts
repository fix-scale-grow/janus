import { TemplatePurpose } from "@crm/db/enums";
import { z } from "zod";

export const TEMPLATE_BLOCKS = {
	heading: { maxTextLength: 300, defaultText: "New heading" },
	text: {
		maxHtmlLength: 8000,
		allowedTags: ["b", "i", "strong", "em", "br", "a", "span"],
		allowedHrefSchemes: ["http:", "https:", "mailto:"],
		defaultHtml: "New paragraph.",
	},
	button: { maxLabelLength: 80, defaultLabel: "Review and sign" },
	spacer: { minHeight: 4, maxHeight: 96, defaultHeight: 24 },
} as const;

export const templateBlockSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("heading"),
		text: z.string().max(TEMPLATE_BLOCKS.heading.maxTextLength),
	}),
	z.object({
		kind: z.literal("text"),
		html: z.string().max(TEMPLATE_BLOCKS.text.maxHtmlLength),
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

export type TemplateBlockKind = TemplateBlock["kind"];

export const templateBlocksSchema = z.array(templateBlockSchema);

export function parseTemplateBlocks(value: unknown): TemplateBlock[] | null {
	const parsed = templateBlocksSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export const BLOCK_KIND_LABELS: Record<TemplateBlockKind, string> = {
	heading: "Heading",
	text: "Text",
	button: "Button",
	logo: "Logo",
	divider: "Divider",
	spacer: "Spacer",
};

export const BLOCK_KIND_ORDER: TemplateBlockKind[] = [
	"heading",
	"text",
	"button",
	"logo",
	"divider",
	"spacer",
];

const CONTRACT_BODY_HIDDEN_KINDS: TemplateBlockKind[] = ["button", "spacer"];

export function blockKindsFor(purpose: TemplatePurpose): TemplateBlockKind[] {
	if (purpose !== TemplatePurpose.CONTRACT_BODY) return BLOCK_KIND_ORDER;
	return BLOCK_KIND_ORDER.filter(
		(kind) => !CONTRACT_BODY_HIDDEN_KINDS.includes(kind),
	);
}

export function createTemplateBlock(kind: TemplateBlockKind): TemplateBlock {
	switch (kind) {
		case "heading":
			return { kind, text: TEMPLATE_BLOCKS.heading.defaultText };
		case "text":
			return { kind, html: TEMPLATE_BLOCKS.text.defaultHtml };
		case "button":
			return { kind, label: TEMPLATE_BLOCKS.button.defaultLabel };
		case "spacer":
			return { kind, height: TEMPLATE_BLOCKS.spacer.defaultHeight };
		default:
			return { kind };
	}
}

export function isEditableBlock(block: TemplateBlock): boolean {
	return block.kind === "heading" || block.kind === "text";
}

export type MergeField = { token: string; label: string };

export type MergeFieldGroup = {
	id: string;
	label: string;
	fields: MergeField[];
};

export const MERGE_FIELD_GROUPS: MergeFieldGroup[] = [
	{
		id: "contact",
		label: "Contact",
		fields: [
			{ token: "contact.full_name", label: "Full name" },
			{ token: "contact.first_name", label: "First name" },
			{ token: "contact.email", label: "Email address" },
		],
	},
	{
		id: "business",
		label: "Business",
		fields: [
			{ token: "business.name", label: "Business name" },
			{ token: "business.phone", label: "Business phone" },
			{ token: "sender.name", label: "Sender name" },
		],
	},
	{
		id: "deal",
		label: "Job",
		fields: [
			{ token: "deal.title", label: "Job title" },
			{ token: "deal.address", label: "Job address" },
		],
	},
	{
		id: "estimate",
		label: "Estimate",
		fields: [
			{ token: "estimate.title", label: "Estimate title" },
			{ token: "estimate.total", label: "Total price" },
			{ token: "estimate.tier", label: "Estimate tier" },
		],
	},
	{
		id: "invoice",
		label: "Invoice",
		fields: [
			{ token: "invoice.number", label: "Invoice number" },
			{ token: "invoice.total", label: "Amount due" },
			{ token: "invoice.due_date", label: "Due date" },
		],
	},
	{
		id: "contract",
		label: "Contract",
		fields: [
			{ token: "contract.number", label: "Contract number" },
			{ token: "contract.title", label: "Contract title" },
		],
	},
	{
		id: "send",
		label: "Sending",
		fields: [
			{ token: "signing_link", label: "Signing link" },
			{ token: "personal_note", label: "Personal note" },
		],
	},
];

const MERGE_FIELD_LABELS: Record<string, string> = Object.fromEntries(
	MERGE_FIELD_GROUPS.flatMap((group) =>
		group.fields.map((field) => [field.token, field.label]),
	),
);

export function mergeFieldLabel(token: string): string {
	return MERGE_FIELD_LABELS[token] ?? `{{${token}}}`;
}
