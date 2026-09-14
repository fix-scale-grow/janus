"use client";

import { TemplatePurpose } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	BlockCanvas,
	type EditorBlock,
} from "@/components/templates/block-canvas";
import { BlockPalette } from "@/components/templates/block-palette";
import {
	type MergeFieldLabels,
	toEditorHtml,
	toEditorText,
} from "@/components/templates/block-serialize";
import type {
	TemplateBlock,
	TemplateBlockKind,
} from "@/components/templates/merge-fields";
import {
	createTemplateBlock,
	useMergeFields,
} from "@/components/templates/merge-fields";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type DocumentChrome = RouterOutputs["settings"]["documentChrome"];

const CHROME_KINDS: TemplateBlockKind[] = [
	"heading",
	"text",
	"divider",
	"spacer",
];

function toRows(
	blocks: TemplateBlock[],
	nextId: { current: number },
): EditorBlock[] {
	return blocks.map((block) => {
		const id = `chrome-${nextId.current}`;
		nextId.current += 1;
		return { id, block };
	});
}

function PreviewBlock({
	block,
	labels,
}: {
	block: TemplateBlock;
	labels: MergeFieldLabels;
}) {
	if (block.kind === "heading") {
		return (
			<span
				className="font-semibold text-sm"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before storage
				dangerouslySetInnerHTML={{ __html: toEditorText(block.text, labels) }}
			/>
		);
	}
	if (block.kind === "text") {
		return (
			<span
				className="text-muted-foreground text-xs"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: block html is sanitized before storage
				dangerouslySetInnerHTML={{ __html: toEditorHtml(block.html, labels) }}
			/>
		);
	}
	if (block.kind === "divider") {
		return <hr className="my-0.5 w-32 border-t" />;
	}
	if (block.kind === "spacer") {
		return <span style={{ height: Math.min(block.height, 24) }} />;
	}
	return null;
}

export function DocumentChromeForm() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const settings = useQuery(trpc.settings.documentChrome.queryOptions());
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const accent = workspace.data?.brandColor ?? "#006b4f";

	const mergeFields = useMergeFields();
	const labels: MergeFieldLabels = useMemo(
		() =>
			Object.fromEntries(
				mergeFields.groups.flatMap((group) =>
					group.fields.map((field) => [field.token, field.label]),
				),
			),
		[mergeFields.groups],
	);

	const nextId = useRef(0);
	const [headerRows, setHeaderRows] = useState<EditorBlock[] | null>(null);
	const [footerRows, setFooterRows] = useState<EditorBlock[] | null>(null);
	const [baseline, setBaseline] = useState<string | null>(null);

	if (settings.data && headerRows === null) {
		setHeaderRows(toRows(settings.data.headerBlocks, nextId));
		setFooterRows(toRows(settings.data.footerBlocks, nextId));
		setBaseline(JSON.stringify(settings.data));
	}

	const save = useMutation(
		trpc.settings.setDocumentChrome.mutationOptions({
			onSuccess: async (result) => {
				setBaseline(JSON.stringify(result));
				await queryClient.invalidateQueries({
					queryKey: trpc.settings.documentChrome.queryKey(),
				});
				toast.success("Header and footer saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!headerRows || !footerRows) return null;

	const current: DocumentChrome = {
		headerBlocks: headerRows.map((row) => row.block),
		footerBlocks: footerRows.map((row) => row.block),
	};
	const dirty = JSON.stringify(current) !== baseline;

	const addTo =
		(rows: EditorBlock[], setRows: (next: EditorBlock[]) => void) =>
		(kind: TemplateBlockKind) => {
			const id = `chrome-${nextId.current}`;
			nextId.current += 1;
			setRows([...rows, { id, block: createTemplateBlock(kind) }]);
		};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>Document header and footer</CardTitle>
				<Button
					size="sm"
					disabled={!dirty || save.isPending}
					onClick={() => save.mutate(current)}
				>
					{save.isPending ? <Spinner data-icon="inline-start" /> : null}
					Save
				</Button>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<p className="text-muted-foreground text-sm">
					Design what prints at the top and bottom of every contract and
					proposal PDF page. Drag blocks to reorder; merge fields fill from your
					workspace. The accent bar, document number and page count are added
					automatically.
				</p>

				<div className="overflow-hidden rounded-lg border">
					<div className="h-1.5" style={{ backgroundColor: accent }} />
					<div className="flex items-end justify-between gap-4 border-b px-4 pt-3 pb-2.5">
						<div className="flex min-w-0 flex-col gap-0.5">
							{current.headerBlocks.map((block, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: preview only
								<PreviewBlock key={index} block={block} labels={labels} />
							))}
						</div>
						<span className="shrink-0 text-muted-foreground text-xs">
							C-0042
						</span>
					</div>
					<div className="flex h-14 items-center justify-center text-muted-foreground text-xs">
						Document content
					</div>
					<div className="flex items-end justify-between gap-4 border-t px-4 py-2">
						<div className="flex min-w-0 flex-col gap-0.5">
							{current.footerBlocks.map((block, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: preview only
								<PreviewBlock key={index} block={block} labels={labels} />
							))}
						</div>
						<span className="shrink-0 text-muted-foreground text-xs">
							Page 1 of 2
						</span>
					</div>
				</div>

				<div className="flex flex-col gap-3">
					<h3 className="font-medium text-sm">Header</h3>
					<div className="grid gap-4 md:grid-cols-[1fr_200px]">
						<BlockCanvas
							blocks={headerRows}
							onChange={setHeaderRows}
							labels={labels}
						/>
						<BlockPalette
							purpose={TemplatePurpose.CONTRACT_BODY}
							kinds={CHROME_KINDS}
							onAdd={addTo(headerRows, setHeaderRows)}
						/>
					</div>
				</div>

				<div className="flex flex-col gap-3">
					<h3 className="font-medium text-sm">Footer</h3>
					<div className="grid gap-4 md:grid-cols-[1fr_200px]">
						<BlockCanvas
							blocks={footerRows}
							onChange={setFooterRows}
							labels={labels}
						/>
						<BlockPalette
							purpose={TemplatePurpose.CONTRACT_BODY}
							kinds={CHROME_KINDS}
							onAdd={addTo(footerRows, setFooterRows)}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
