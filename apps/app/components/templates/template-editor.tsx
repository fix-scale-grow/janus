"use client";

import type { TemplatePurpose } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { TEMPLATE_LABELS } from "./template-labels";

export type TemplateDetail = RouterOutputs["templates"]["byPurpose"];

const templateBlockSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("heading"), text: z.string() }),
	z.object({ kind: z.literal("text"), html: z.string() }),
	z.object({ kind: z.literal("button"), label: z.string() }),
	z.object({ kind: z.literal("logo") }),
	z.object({ kind: z.literal("divider") }),
	z.object({ kind: z.literal("spacer"), height: z.number() }),
]);

type TemplateBlock = z.infer<typeof templateBlockSchema>;

const templateBlocksSchema = z.array(templateBlockSchema);

const BLOCK_KIND_LABEL: Record<TemplateBlock["kind"], string> = {
	heading: "Heading",
	text: "Text",
	button: "Button",
	logo: "Logo",
	divider: "Divider",
	spacer: "Spacer",
};

const AVAILABLE_BLOCK_KINDS = Object.values(BLOCK_KIND_LABEL);

function blockSummary(block: TemplateBlock): string {
	switch (block.kind) {
		case "heading":
			return block.text;
		case "text":
			return block.html.replace(/<[^>]*>/g, "").trim();
		case "button":
			return block.label;
		case "spacer":
			return `${block.height}px`;
		default:
			return "";
	}
}

function parseBlocks(value: unknown): TemplateBlock[] | null {
	const parsed = templateBlocksSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

type EditorMode = "edit" | "preview";

export function TemplateEditor({ template }: { template: TemplateDetail }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const toId = useId();

	const purpose = template.purpose as TemplatePurpose;
	const label = TEMPLATE_LABELS[purpose];

	const [mode, setMode] = useState<EditorMode>("edit");
	const [sendTestOpen, setSendTestOpen] = useState(false);
	const [to, setTo] = useState("");

	const rawBlocks = (template as unknown as { blocks: unknown }).blocks;
	const initialBlocks = useMemo(() => parseBlocks(rawBlocks), [rawBlocks]);
	const [blocks] = useState<TemplateBlock[] | null>(initialBlocks);

	const dirty =
		blocks !== null && JSON.stringify(blocks) !== JSON.stringify(initialBlocks);

	const mailerConfigured = useQuery(
		trpc.templates.mailerConfigured.queryOptions(),
	);

	const preview = useQuery({
		...trpc.templates.preview.queryOptions({ purpose }),
		enabled: mode === "preview",
	});

	const save = useMutation(trpc.templates.update.mutationOptions());

	const sendTest = useMutation(
		trpc.templates.sendTest.mutationOptions({
			onSuccess: () => {
				toast.success("Test email sent.");
				setSendTestOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const handleSave = () => {
		if (!blocks) return;
		save.mutate(
			{
				purpose,
				name: template.name,
				subject: template.subject ?? undefined,
				blocks,
			},
			{
				onSuccess: async () => {
					await cache.template(purpose);
					toast.success("Template saved.");
				},
				onError: (error) => toast.error(error.message),
			},
		);
	};

	const submitSendTest = () => {
		const trimmed = to.trim();
		if (!trimmed) {
			toast.error("Enter an email address to test with.");
			return;
		}
		sendTest.mutate({ purpose, to: trimmed });
	};

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{label.name}</PageShellTitle>
					<PageShellDescription>{label.usedFor}</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Tabs
						value={mode}
						onValueChange={(next) => setMode(next as EditorMode)}
					>
						<TabsList>
							<TabsTrigger value="edit">Edit</TabsTrigger>
							<TabsTrigger value="preview">Preview</TabsTrigger>
						</TabsList>
					</Tabs>
					{mailerConfigured.data ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setSendTestOpen(true)}
						>
							Send test
						</Button>
					) : null}
					<Button
						size="sm"
						disabled={!dirty || save.isPending}
						onClick={handleSave}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				{mode === "edit" ? (
					blocks ? (
						<div className="grid gap-4 md:grid-cols-[220px_1fr_260px]">
							<BlockPalettePane />
							<BlockCanvasPane blocks={blocks} />
							<FieldSidebarPane templateName={label.name} />
						</div>
					) : (
						<div className="rounded-lg border p-4 text-muted-foreground text-sm">
							This template's blocks could not be read.
						</div>
					)
				) : (
					<div className="overflow-hidden rounded-lg border">
						{preview.isPending ? (
							<div className="flex justify-center py-12">
								<Spinner size="lg" />
							</div>
						) : (
							<iframe
								title="Template preview"
								srcDoc={preview.data?.html ?? ""}
								className="h-[640px] w-full"
							/>
						)}
					</div>
				)}
			</PageShellContent>

			<Dialog open={sendTestOpen} onOpenChange={setSendTestOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Send a test email</DialogTitle>
						<DialogDescription>
							Sends this template, filled with sample data, to one address.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor={toId}>Send to</FieldLabel>
						<Input
							id={toId}
							type="email"
							autoFocus
							value={to}
							onChange={(event) => setTo(event.target.value)}
						/>
					</Field>
					<DialogFooter>
						<Button
							variant="ghost"
							disabled={sendTest.isPending}
							onClick={() => setSendTestOpen(false)}
						>
							Cancel
						</Button>
						<Button disabled={sendTest.isPending} onClick={submitSendTest}>
							{sendTest.isPending ? <Spinner data-icon="inline-start" /> : null}
							Send test
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageShell>
	);
}

function BlockPalettePane() {
	return (
		<div className="flex flex-col gap-2 rounded-lg border p-4">
			<h2 className="font-medium text-sm">Block kinds</h2>
			<ul className="flex flex-col gap-1 text-muted-foreground text-sm">
				{AVAILABLE_BLOCK_KINDS.map((kind) => (
					<li key={kind}>{kind}</li>
				))}
			</ul>
		</div>
	);
}

function BlockCanvasPane({ blocks }: { blocks: TemplateBlock[] }) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border p-4">
			<h2 className="font-medium text-sm">Blocks</h2>
			<ol className="flex flex-col gap-2 text-sm">
				{blocks.map((block) => (
					<li
						key={`${block.kind}:${blockSummary(block)}`}
						className="rounded-md border px-3 py-2"
					>
						<div className="font-medium">{BLOCK_KIND_LABEL[block.kind]}</div>
						<div className="truncate text-muted-foreground">
							{blockSummary(block) || "—"}
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}

function FieldSidebarPane({ templateName }: { templateName: string }) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border p-4">
			<h2 className="font-medium text-sm">Merge fields</h2>
			<p className="text-muted-foreground text-sm">
				Fields that insert values, like a contact's name or the total for{" "}
				{templateName}.
			</p>
		</div>
	);
}
