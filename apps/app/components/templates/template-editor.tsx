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
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import {
	BlockCanvas,
	type BlockCanvasHandle,
	type EditorBlock,
} from "./block-canvas";
import { BlockPalette } from "./block-palette";
import { FieldSidebar } from "./field-sidebar";
import {
	createTemplateBlock,
	parseTemplateBlocks,
	type TemplateBlockKind,
	useMergeFields,
} from "./merge-fields";
import { TEMPLATE_LABELS } from "./template-labels";
import { TemplatePreview } from "./template-preview";

export type TemplateDetail = RouterOutputs["templates"]["byPurpose"];

type EditorMode = "edit" | "preview";

export function TemplateEditor({
	template,
	testEmail,
}: {
	template: TemplateDetail;
	testEmail: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const toId = useId();
	const subjectId = useId();

	const purpose = template.purpose as TemplatePurpose;
	const label = TEMPLATE_LABELS[purpose];

	const [mode, setMode] = useState<EditorMode>("edit");
	const [sendTestOpen, setSendTestOpen] = useState(false);
	const [to, setTo] = useState(testEmail);

	const canvas = useRef<BlockCanvasHandle>(null);
	const nextId = useRef(0);

	const mergeFields = useMergeFields();
	const labels = useMemo(
		() =>
			Object.fromEntries(
				mergeFields.groups.flatMap((group) =>
					group.fields.map((field) => [field.token, field.label]),
				),
			),
		[mergeFields.groups],
	);

	const rawBlocks = (template as unknown as { blocks: unknown }).blocks;
	const initialBlocks = useMemo(
		() => parseTemplateBlocks(rawBlocks),
		[rawBlocks],
	);

	const [rows, setRows] = useState<EditorBlock[] | null>(() =>
		initialBlocks
			? initialBlocks.map((block) => {
					const id = `block-${nextId.current}`;
					nextId.current += 1;
					return { id, block };
				})
			: null,
	);

	const [subject, setSubject] = useState(template.subject ?? "");

	const blocks = rows?.map((row) => row.block) ?? null;
	const snapshot = JSON.stringify({ blocks, subject });

	const [baseline, setBaseline] = useState(() =>
		JSON.stringify({ blocks: initialBlocks, subject: template.subject ?? "" }),
	);

	const dirty = blocks !== null && snapshot !== baseline;

	const mailerConfigured = useQuery(
		trpc.templates.mailerConfigured.queryOptions(),
	);

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

	const addBlock = (kind: TemplateBlockKind) => {
		const id = `block-${nextId.current}`;
		nextId.current += 1;
		setRows([...(rows ?? []), { id, block: createTemplateBlock(kind) }]);
	};

	const insertField = (token: string) => {
		if (canvas.current?.insertField(token)) return;
		toast.error("Add a heading or text block first.");
	};

	const handleSave = () => {
		if (!blocks) return;
		save.mutate(
			{
				purpose,
				name: template.name,
				subject: template.subject === null ? undefined : subject.trim(),
				blocks,
			},
			{
				onSuccess: async () => {
					setBaseline(snapshot);
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
					rows ? (
						mergeFields.groups.length > 0 ? (
							<div className="flex flex-col gap-4">
								{template.subject === null ? null : (
									<Field>
										<FieldLabel htmlFor={subjectId}>Subject</FieldLabel>
										<Input
											id={subjectId}
											value={subject}
											onChange={(event) => setSubject(event.target.value)}
										/>
									</Field>
								)}
								<div className="grid gap-4 md:grid-cols-[220px_1fr_260px]">
									<BlockPalette purpose={purpose} onAdd={addBlock} />
									<BlockCanvas
										ref={canvas}
										blocks={rows}
										onChange={setRows}
										labels={labels}
									/>
									<FieldSidebar onInsert={insertField} />
								</div>
							</div>
						) : (
							<Spinner />
						)
					) : (
						<div className="rounded-lg border p-4 text-muted-foreground text-sm">
							This template's blocks could not be read.
						</div>
					)
				) : (
					<TemplatePreview
						purpose={purpose}
						subject={template.subject}
						stale={dirty}
					/>
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
