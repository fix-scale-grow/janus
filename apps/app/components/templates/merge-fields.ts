import { TemplatePurpose } from "@crm/db/enums";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { useTRPC } from "@/lib/trpc/client";

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

export const blockColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const blockAlignSchema = z.enum(["left", "center", "right"]);

export const blockSizeSchema = z.enum(["sm", "md", "lg", "xl"]);

export type BlockAlign = z.infer<typeof blockAlignSchema>;
export type BlockSize = z.infer<typeof blockSizeSchema>;

const headingBlockSchema = z.object({
	kind: z.literal("heading"),
	text: z.string().max(TEMPLATE_BLOCKS.heading.maxTextLength),
	align: blockAlignSchema.optional(),
	color: blockColorSchema.optional(),
	size: blockSizeSchema.optional(),
});

const textBlockSchema = z.object({
	kind: z.literal("text"),
	html: z.string().max(TEMPLATE_BLOCKS.text.maxHtmlLength),
	align: blockAlignSchema.optional(),
	color: blockColorSchema.optional(),
});

const logoBlockSchema = z.object({
	kind: z.literal("logo"),
	size: blockSizeSchema.optional(),
	align: blockAlignSchema.optional(),
});

const dividerBlockSchema = z.object({
	kind: z.literal("divider"),
	color: blockColorSchema.optional(),
});

const spacerBlockSchema = z.object({
	kind: z.literal("spacer"),
	height: z
		.number()
		.int()
		.min(TEMPLATE_BLOCKS.spacer.minHeight)
		.max(TEMPLATE_BLOCKS.spacer.maxHeight),
});

export const columnChildSchema = z.discriminatedUnion("kind", [
	headingBlockSchema,
	textBlockSchema,
	logoBlockSchema,
	dividerBlockSchema,
	spacerBlockSchema,
]);

export type ColumnChildBlock = z.infer<typeof columnChildSchema>;

export const templateBlockSchema = z.discriminatedUnion("kind", [
	headingBlockSchema,
	textBlockSchema,
	z.object({
		kind: z.literal("button"),
		label: z.string().max(TEMPLATE_BLOCKS.button.maxLabelLength),
		color: blockColorSchema.optional(),
	}),
	logoBlockSchema,
	dividerBlockSchema,
	z.object({ kind: z.literal("signature") }),
	z.object({ kind: z.literal("pageBreak") }),
	z.object({
		kind: z.literal("columns"),
		columns: z.array(z.array(columnChildSchema).max(6)).min(2).max(3),
	}),
	spacerBlockSchema,
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
	signature: "Signature field",
	pageBreak: "Page break",
	columns: "Columns",
};

export const BLOCK_KIND_ORDER: TemplateBlockKind[] = [
	"heading",
	"text",
	"button",
	"logo",
	"divider",
	"columns",
	"pageBreak",
	"signature",
	"spacer",
];

const DOCUMENT_ONLY_KINDS: TemplateBlockKind[] = ["signature", "pageBreak"];
const CONTRACT_BODY_HIDDEN_KINDS: TemplateBlockKind[] = ["button", "spacer"];
const PROPOSAL_BODY_HIDDEN_KINDS: TemplateBlockKind[] = [
	"button",
	"spacer",
	"signature",
];

export function blockKindsFor(purpose: TemplatePurpose): TemplateBlockKind[] {
	if (purpose === TemplatePurpose.CONTRACT_BODY) {
		return BLOCK_KIND_ORDER.filter(
			(kind) => !CONTRACT_BODY_HIDDEN_KINDS.includes(kind),
		);
	}
	if (purpose === TemplatePurpose.PROPOSAL_BODY) {
		return BLOCK_KIND_ORDER.filter(
			(kind) => !PROPOSAL_BODY_HIDDEN_KINDS.includes(kind),
		);
	}
	return BLOCK_KIND_ORDER.filter((kind) => !DOCUMENT_ONLY_KINDS.includes(kind));
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
		case "columns":
			return { kind, columns: [[], []] };
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

export type MergeFields = {
	groups: MergeFieldGroup[];
	labelFor(token: string): string;
	isLoading: boolean;
	isError: boolean;
};

export function useMergeFields(): MergeFields {
	const trpc = useTRPC();

	const query = useQuery({
		...trpc.templates.mergeFields.queryOptions(),
		placeholderData: (previous) => previous,
	});

	const groups = query.data?.groups ?? [];

	const labels = useMemo(
		() =>
			new Map(
				groups.flatMap((group) =>
					group.fields.map((field) => [field.token, field.label] as const),
				),
			),
		[groups],
	);

	return useMemo(
		() => ({
			groups,
			labelFor: (token: string) => labels.get(token) ?? `{{${token}}}`,
			isLoading: query.isPending,
			isError: query.isError,
		}),
		[groups, labels, query.isPending, query.isError],
	);
}
