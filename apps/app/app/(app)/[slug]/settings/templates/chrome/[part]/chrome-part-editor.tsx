"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import { TemplatePurpose } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
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
import {
	createTemplateBlock,
	type TemplateBlock,
	type TemplateBlockKind,
	useMergeFields,
} from "@/components/templates/merge-fields";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type DocumentChrome = RouterOutputs["settings"]["documentChrome"];

export type ChromePart = "header" | "footer";

const CHROME_KINDS: TemplateBlockKind[] = [
	"logo",
	"heading",
	"text",
	"divider",
	"spacer",
];

const PART_COPY: Record<ChromePart, { title: string; hint: string }> = {
	header: {
		title: "Document header",
		hint: "Prints at the top of every contract and proposal PDF page.",
	},
	footer: {
		title: "Document footer",
		hint: "Prints at the bottom of every contract and proposal PDF page.",
	},
};

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
	if (block.kind === "logo") {
		return (
			// biome-ignore lint/performance/noImgElement: small live preview of the uploaded logo
			<img
				src="/api/workspace/logo/file"
				alt="Logo"
				className="max-h-8 w-auto self-start object-contain"
			/>
		);
	}
	return null;
}

export function ChromePartEditor({
	part,
	initialChrome,
	accent,
}: {
	part: ChromePart;
	initialChrome: DocumentChrome;
	accent: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();

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
	const partBlocks =
		part === "header" ? initialChrome.headerBlocks : initialChrome.footerBlocks;
	const [rows, setRows] = useState<EditorBlock[]>(() =>
		partBlocks.map((block) => {
			const id = `chrome-${nextId.current}`;
			nextId.current += 1;
			return { id, block };
		}),
	);
	const [baseline, setBaseline] = useState(() => JSON.stringify(partBlocks));
	const dirty = JSON.stringify(rows.map((row) => row.block)) !== baseline;

	const save = useMutation(
		trpc.settings.setDocumentChrome.mutationOptions({
			onSuccess: async (result) => {
				setBaseline(
					JSON.stringify(
						part === "header" ? result.headerBlocks : result.footerBlocks,
					),
				);
				await queryClient.invalidateQueries({
					queryKey: trpc.settings.documentChrome.queryKey(),
				});
				toast.success(`${PART_COPY[part].title} saved.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const currentBlocks = rows.map((row) => row.block);
	const headerBlocks =
		part === "header" ? currentBlocks : initialChrome.headerBlocks;
	const footerBlocks =
		part === "footer" ? currentBlocks : initialChrome.footerBlocks;

	const submit = () => {
		save.mutate({ headerBlocks, footerBlocks });
	};

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<div className="flex items-center gap-2">
						<Button asChild variant="ghost" size="icon-sm">
							<Link
								href={workspaceUrl("/settings/templates")}
								aria-label="Back to templates"
							>
								<Icon icon={ArrowLeft} />
							</Link>
						</Button>
						<PageShellTitle>{PART_COPY[part].title}</PageShellTitle>
					</div>
				</PageShellHeading>
				<PageShellActions>
					<Button
						size="sm"
						disabled={!dirty || save.isPending}
						onClick={submit}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<div className="flex max-w-3xl flex-col gap-6">
					<p className="text-muted-foreground text-sm">
						{PART_COPY[part].hint} Drag blocks to reorder; merge fields fill
						from your workspace. The accent bar, document number and page count
						are added automatically.
					</p>

					<div className="overflow-hidden rounded-lg border">
						<div className="h-1.5" style={{ backgroundColor: accent }} />
						<div
							className={cn(
								"flex items-end justify-between gap-4 border-b px-4 pt-3 pb-2.5",
								part === "header" && "bg-accent/40",
							)}
						>
							<div className="flex min-w-0 flex-col gap-0.5">
								{headerBlocks.map((block, index) => (
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
						<div
							className={cn(
								"flex items-end justify-between gap-4 border-t px-4 py-2",
								part === "footer" && "bg-accent/40",
							)}
						>
							<div className="flex min-w-0 flex-col gap-0.5">
								{footerBlocks.map((block, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: preview only
									<PreviewBlock key={index} block={block} labels={labels} />
								))}
							</div>
							{footerBlocks.length === 0 ? (
								<span className="text-muted-foreground text-xs">
									Nothing here yet
								</span>
							) : null}
							<span className="shrink-0 text-muted-foreground text-xs">
								Page 1 of 2
							</span>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-[1fr_200px]">
						<BlockCanvas blocks={rows} onChange={setRows} labels={labels} />
						<BlockPalette
							purpose={TemplatePurpose.CONTRACT_BODY}
							kinds={CHROME_KINDS}
							onAdd={(kind) => {
								const id = `chrome-${nextId.current}`;
								nextId.current += 1;
								setRows([...rows, { id, block: createTemplateBlock(kind) }]);
							}}
						/>
					</div>
				</div>
			</PageShellContent>
		</PageShell>
	);
}
