"use client";

import Add from "@carbon/icons-react/es/Add";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Renew from "@carbon/icons-react/es/Renew";
import Warning from "@carbon/icons-react/es/Warning";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@crm/ui/components/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { SortableItem, SortableList } from "@crm/ui/components/sortable-list";
import { Spinner } from "@crm/ui/components/spinner";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	ARCHIVE_PIPELINE,
	ARCHIVE_PIPELINE_BODY,
	ARCHIVED_PIPELINES,
	ARCHIVED_PIPELINES_NOTE,
	ARCHIVED_STAGES,
	ARCHIVED_STAGES_NOTE,
	archivePipelineTitle,
	CANCEL,
	DRAG_NOTE,
	EMPTY_BODY,
	EMPTY_TITLE,
	ERROR_BODY,
	ERROR_TITLE,
	NEW_PIPELINE,
	NEW_PIPELINE_NAME,
	NEW_STAGE,
	NEW_STAGE_LABEL,
	RESTORE,
	RETRY,
	stageCountNote,
} from "./pipeline-copy";
import { StageRow } from "./stage-row";
import { STAGE_SWATCHES } from "./stage-swatches";

type Pipeline = RouterOutputs["pipelines"]["list"][number];
type Stage = Pipeline["stages"][number];

const STAGE_ROW = "flex items-center gap-2 border-b px-4 py-2 last:border-b-0";

function reorderedPipelines(pipelines: Pipeline[], ids: string[]): Pipeline[] {
	const live = pipelines.filter((pipeline) => !pipeline.archivedAt);
	const byId = new Map(live.map((pipeline) => [pipeline.id, pipeline]));
	const queue = ids
		.map((id) => byId.get(id))
		.filter((pipeline): pipeline is Pipeline => pipeline !== undefined);

	if (queue.length !== live.length) return pipelines;

	return pipelines.map((pipeline) =>
		pipeline.archivedAt ? pipeline : (queue.shift() ?? pipeline),
	);
}

function reorderedStages(
	pipelines: Pipeline[],
	pipelineId: string,
	ids: string[],
): Pipeline[] {
	return pipelines.map((pipeline) => {
		if (pipeline.id !== pipelineId) return pipeline;

		const live = pipeline.stages.filter((stage) => !stage.archivedAt);
		const byId = new Map(live.map((stage) => [stage.id, stage]));
		const queue = ids
			.map((id) => byId.get(id))
			.filter((stage): stage is Stage => stage !== undefined);

		if (queue.length !== live.length) return pipeline;

		return {
			...pipeline,
			stages: pipeline.stages.map((stage) =>
				stage.archivedAt ? stage : (queue.shift() ?? stage),
			),
		};
	});
}

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const nameId = useId();

	const [open, setOpen] = useState(true);
	const [name, setName] = useState(pipeline.name);
	const [confirmingArchive, setConfirmingArchive] = useState(false);

	const listKey = trpc.pipelines.list.queryKey({ includeArchived: true });

	const live = pipeline.stages.filter((stage) => !stage.archivedAt);
	const archivedStages = pipeline.stages.filter((stage) => stage.archivedAt);

	const rename = useMutation(
		trpc.pipelines.updatePipeline.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const archive = useMutation(
		trpc.pipelines.archivePipeline.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const reorderStages = useMutation(
		trpc.pipelines.reorderStages.mutationOptions({
			onMutate: async ({ pipelineId, ids }) => {
				await queryClient.cancelQueries({ queryKey: listKey });
				const previous = queryClient.getQueryData(listKey);
				if (previous) {
					queryClient.setQueryData(
						listKey,
						reorderedStages(previous, pipelineId, ids),
					);
				}
				return { previous };
			},
			onError: (error, _input, context) => {
				if (context?.previous)
					queryClient.setQueryData(listKey, context.previous);
				toast.error(error.message);
			},
			onSettled: () => cache.pipeline(),
		}),
	);

	const createStage = useMutation(
		trpc.pipelines.createStage.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const commitName = () => {
		const trimmed = name.trim();
		if (trimmed === "") {
			setName(pipeline.name);
			return;
		}
		if (trimmed !== pipeline.name) {
			rename.mutate({ id: pipeline.id, data: { name: trimmed } });
		}
	};

	const addStage = () => {
		const color =
			STAGE_SWATCHES[live.length % STAGE_SWATCHES.length] ?? STAGE_SWATCHES[0];
		createStage.mutate({
			pipelineId: pipeline.id,
			label: NEW_STAGE_LABEL,
			color,
			outcome: "OPEN",
		});
	};

	return (
		<div className="flex flex-col rounded-lg border bg-card">
			<Collapsible open={open} onOpenChange={setOpen}>
				<div className="flex items-center gap-2.5 px-4 py-3">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="icon-xs" className="shrink-0">
							<Icon
								icon={ChevronRight}
								className={cn("transition-transform", open && "rotate-90")}
							/>
							<span className="sr-only">{pipeline.name}</span>
						</Button>
					</CollapsibleTrigger>

					<label htmlFor={nameId} className="sr-only">
						Pipeline name
					</label>
					<Input
						id={nameId}
						value={name}
						onChange={(event) => setName(event.target.value)}
						onBlur={commitName}
						onKeyDown={(event) => {
							if (event.key === "Enter") event.currentTarget.blur();
						}}
						className="h-7 max-w-64 flex-1 border-transparent bg-transparent px-1.5 font-medium hover:border-input focus-visible:border-ring"
					/>

					<span className="shrink-0 text-muted-foreground text-xs">
						{stageCountNote(live.length)}
					</span>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-xs" className="shrink-0">
								<Icon icon={OverflowMenuVertical} />
								<span className="sr-only">More for {pipeline.name}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => setConfirmingArchive(true)}>
								{ARCHIVE_PIPELINE}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<CollapsibleContent>
					<div className="border-t">
						<SortableList
							ids={live.map((stage) => stage.id)}
							onReorder={(ids) =>
								reorderStages.mutate({ pipelineId: pipeline.id, ids })
							}
						>
							{live.map((stage) => (
								<SortableItem key={stage.id} id={stage.id} label={stage.label}>
									<StageRow stage={stage} className={cn(STAGE_ROW, "flex-1")} />
								</SortableItem>
							))}
						</SortableList>

						{archivedStages.length > 0 ? (
							<Collapsible>
								<CollapsibleTrigger asChild>
									<button
										type="button"
										className="flex w-full items-center gap-2 border-b bg-muted/40 px-4 py-2 text-left"
									>
										<Icon
											icon={ChevronRight}
											className="shrink-0 text-muted-foreground"
										/>
										<span className="flex-1 font-medium text-foreground text-xs">
											{ARCHIVED_STAGES}
										</span>
										<span className="shrink-0 text-muted-foreground text-xs">
											{archivedStages.length} · {ARCHIVED_STAGES_NOTE}
										</span>
									</button>
								</CollapsibleTrigger>
								<CollapsibleContent>
									{archivedStages.map((stage) => (
										<StageRow
											key={stage.id}
											stage={stage}
											className="flex items-center gap-2 border-b bg-muted/20 px-4 py-2 pl-11 last:border-b-0"
										/>
									))}
								</CollapsibleContent>
							</Collapsible>
						) : null}

						<div className="px-4 py-2.5">
							<Button
								variant="ghost"
								size="sm"
								disabled={createStage.isPending}
								onClick={addStage}
							>
								<Icon icon={Add} data-icon="inline-start" />
								{NEW_STAGE}
							</Button>
						</div>
					</div>
				</CollapsibleContent>
			</Collapsible>

			<AlertDialog open={confirmingArchive} onOpenChange={setConfirmingArchive}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{archivePipelineTitle(pipeline.name)}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{ARCHIVE_PIPELINE_BODY}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{CANCEL}</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => archive.mutate({ id: pipeline.id })}
						>
							{ARCHIVE_PIPELINE}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export function PipelineSettings() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();

	const listKey = trpc.pipelines.list.queryKey({ includeArchived: true });

	const query = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: true }),
	);

	const reorderPipelines = useMutation(
		trpc.pipelines.reorderPipelines.mutationOptions({
			onMutate: async ({ ids }) => {
				await queryClient.cancelQueries({ queryKey: listKey });
				const previous = queryClient.getQueryData(listKey);
				if (previous) {
					queryClient.setQueryData(listKey, reorderedPipelines(previous, ids));
				}
				return { previous };
			},
			onError: (error, _input, context) => {
				if (context?.previous)
					queryClient.setQueryData(listKey, context.previous);
				toast.error(error.message);
			},
			onSettled: () => cache.pipeline(),
		}),
	);

	const createPipeline = useMutation(
		trpc.pipelines.createPipeline.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const restorePipeline = useMutation(
		trpc.pipelines.restorePipeline.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	if (query.isPending) {
		return (
			<div className="flex justify-center py-12">
				<Spinner />
			</div>
		);
	}

	if (query.isError) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={Warning} />
					</EmptyMedia>
					<EmptyTitle>{ERROR_TITLE}</EmptyTitle>
					<EmptyDescription>{ERROR_BODY}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						variant="outline"
						disabled={query.isFetching}
						onClick={() => query.refetch()}
					>
						<Icon icon={Renew} data-icon="inline-start" />
						{RETRY}
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	const all = query.data ?? [];
	const live = all.filter((pipeline) => !pipeline.archivedAt);
	const archived = all.filter((pipeline) => pipeline.archivedAt);

	return (
		<div className="flex flex-col gap-4">
			{live.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={Add} />
						</EmptyMedia>
						<EmptyTitle>{EMPTY_TITLE}</EmptyTitle>
						<EmptyDescription>{EMPTY_BODY}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							disabled={createPipeline.isPending}
							onClick={() => createPipeline.mutate({ name: NEW_PIPELINE_NAME })}
						>
							<Icon icon={Add} data-icon="inline-start" />
							{NEW_PIPELINE}
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<>
					<div className="flex items-center justify-between gap-3">
						<span className="text-muted-foreground text-xs">{DRAG_NOTE}</span>
					</div>

					<SortableList
						ids={live.map((pipeline) => pipeline.id)}
						onReorder={(ids) => reorderPipelines.mutate({ ids })}
					>
						<div className="flex flex-col gap-3">
							{live.map((pipeline) => (
								<SortableItem
									key={pipeline.id}
									id={pipeline.id}
									label={pipeline.name}
									className="items-start"
								>
									<div className="min-w-0 flex-1">
										<PipelineCard pipeline={pipeline} />
									</div>
								</SortableItem>
							))}
						</div>
					</SortableList>

					<Button
						variant="outline"
						className="self-start"
						disabled={createPipeline.isPending}
						onClick={() => createPipeline.mutate({ name: NEW_PIPELINE_NAME })}
					>
						<Icon icon={Add} data-icon="inline-start" />
						{NEW_PIPELINE}
					</Button>
				</>
			)}

			{archived.length > 0 ? (
				<Collapsible>
					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5 text-left"
						>
							<Icon
								icon={ChevronRight}
								className="shrink-0 text-muted-foreground"
							/>
							<span className="flex-1 font-medium text-foreground text-xs">
								{ARCHIVED_PIPELINES}
							</span>
							<span className="shrink-0 text-muted-foreground text-xs">
								{archived.length} · {ARCHIVED_PIPELINES_NOTE}
							</span>
						</button>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="mt-2 rounded-lg border">
							{archived.map((pipeline) => (
								<div
									key={pipeline.id}
									className="flex items-center gap-2.5 border-b px-4 py-2 last:border-b-0"
								>
									<span className="flex-1 truncate text-muted-foreground text-xs">
										{pipeline.name}
									</span>
									<Button
										variant="outline"
										size="xs"
										onClick={() => restorePipeline.mutate({ id: pipeline.id })}
									>
										{RESTORE}
									</Button>
								</div>
							))}
						</div>
					</CollapsibleContent>
				</Collapsible>
			) : null}
		</div>
	);
}
