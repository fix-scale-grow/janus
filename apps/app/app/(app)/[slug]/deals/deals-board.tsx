"use client";

import { requiresReason } from "@crm/db/stage-semantics";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
	type QueryKey,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BoardDensityToggle } from "@/components/board/board-density-toggle";
import {
	type BoardDensity,
	useBoardDensity,
} from "@/components/board/use-board-density";
import { usePanScroll } from "@/components/board/use-pan-scroll";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { DealStageMenu } from "@/components/crm/stage-change";
import type { SavedTableView } from "@/components/data-table/list-search-params";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { dealsSearchParams } from "./deals-search-params";

type DealsList = RouterOutputs["deals"]["list"];
type DealRow = DealsList["rows"][number];
type Pipeline = RouterOutputs["pipelines"]["list"][number];

/** Same nuqs keys the `DealStageMenu` uses, so a drag into a losing column drives
 * the globally-mounted `CloseReasonDialog` instead of moving silently. */
const closeReasonParams = {
	closing: parseAsString,
	closingStage: parseAsString,
};

/** Move one row into `stageId` inside a cached `deals.list` payload. Returns the
 * same reference when nothing changed so React-Query skips a needless render. */
function moveRowStage(
	data: DealsList | undefined,
	id: string,
	stage: DealRow["stage"],
): DealsList | undefined {
	if (!data) return data;
	let changed = false;
	const rows = data.rows.map((row) => {
		if (row.id === id && row.stage.id !== stage.id) {
			changed = true;
			return { ...row, stage };
		}
		return row;
	});
	return changed ? { ...data, rows } : data;
}

/**
 * Sales board — the v0-suite kanban (`design/v0-suite/components/jobs/kanban.tsx`)
 * ported onto the engine's real deal data layer. Columns come from the active
 * pipeline's stages (`pipelines.list`), chosen via the nuqs `pipeline` param
 * (default the first non-archived pipeline) and shared with the table's pipeline
 * facet. Rows come from the same `deals.list` query the table uses, scoped to
 * that pipeline.
 *
 * Cards drag between columns (`@dnd-kit`). A drop runs the existing
 * `deals.setStage` mutation with an optimistic move + rollback; a drop into a
 * column whose outcome requires a reason (lost / disqualified) routes through
 * the shared `CloseReasonDialog` (via the same nuqs params `DealStageMenu`
 * uses) so a reason is still captured. The per-card `DealStageMenu` stays as
 * the keyboard-accessible path to the same mutation.
 */
export function DealsBoard({
	savedState,
	boardDensity,
}: {
	savedState?: SavedTableView;
	boardDensity?: BoardDensity;
}) {
	const { ref: panRef, handlers: panHandlers } = usePanScroll<HTMLDivElement>();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();
	const searchParams = useMemo(
		() => dealsSearchParams(savedState),
		[savedState],
	);
	const { input, query } = useTableQuery(searchParams);
	const [, setCloseParams] = useQueryStates(closeReasonParams);
	const [activeId, setActiveId] = useState<string | null>(null);
	const { density, setDensity } = useBoardDensity("deals-board", boardDensity);

	const sensors = useSensors(
		// Distance activation lets a plain click still open the record; only a
		// deliberate drag past 8px starts moving the card.
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: true }),
	);

	const requestedPipelineId =
		input.pipeline !== "all" ? input.pipeline : undefined;
	const activePipeline: Pipeline | undefined =
		pipelines.data?.find((pipeline) => pipeline.id === requestedPipelineId) ??
		pipelines.data?.find((pipeline) => pipeline.archivedAt === null);

	const deals = useQuery({
		...trpc.deals.list.queryOptions({
			...input,
			pipelineId: activePipeline?.id,
		}),
		enabled: Boolean(activePipeline),
		placeholderData: (previous) => previous,
	});

	const setStage = useMutation(
		trpc.deals.setStage.mutationOptions({
			onMutate: async ({ id, stage: stageId }) => {
				const stage = activePipeline?.stages.find((s) => s.id === stageId);
				if (!stage) return;
				const listKey = trpc.deals.list.pathKey();
				await queryClient.cancelQueries({ queryKey: listKey });
				const previous = queryClient.getQueriesData<DealsList>({
					queryKey: listKey,
				});
				queryClient.setQueriesData<DealsList>({ queryKey: listKey }, (data) =>
					moveRowStage(data, id, stage),
				);
				return { previous };
			},
			onError: (error, _variables, context) => {
				for (const [key, data] of (context?.previous ?? []) as [
					QueryKey,
					DealsList | undefined,
				][]) {
					queryClient.setQueryData(key, data);
				}
				toast.error(error.message);
			},
			onSettled: (_data, _error, variables) => {
				void cache.deal(variables.id);
			},
		}),
	);

	const rows = deals.data?.rows ?? [];
	const reportingCurrency = deals.data?.reportingCurrency ?? "usd";
	const columns = activePipeline?.stages ?? [];
	const stageIds = useMemo(
		() => new Set(columns.map((stage) => stage.id)),
		[columns],
	);

	const byStage = useMemo(() => {
		const map = new Map<string, DealRow[]>();
		for (const stage of columns) map.set(stage.id, []);
		for (const row of rows) map.get(row.stage.id)?.push(row);
		return map;
	}, [rows, columns]);

	const activeRow = activeId
		? (rows.find((row) => row.id === activeId) ?? null)
		: null;

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
		const overId = event.over?.id;
		if (overId == null) return;
		const targetId = String(overId);
		if (!stageIds.has(targetId)) return;
		const target = columns.find((stage) => stage.id === targetId);
		if (!target) return;
		const current = event.active.data.current?.stageId as string | undefined;
		if (!current || current === target.id) return;
		const dealId = String(event.active.id);
		if (requiresReason(target)) {
			// Losing moves need a recorded reason — hand off to CloseReasonDialog.
			void setCloseParams({ closing: dealId, closingStage: target.id });
			return;
		}
		setStage.mutate({ id: dealId, stage: target.id });
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				{pipelines.data && pipelines.data.length > 1 ? (
					<Select
						value={activePipeline?.id}
						onValueChange={(value) => query.setFilter("pipeline", value)}
					>
						<SelectTrigger className="w-56">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pipelines.data.map((pipeline) => (
								<SelectItem
									key={pipeline.id}
									value={pipeline.id}
									disabled={pipeline.archivedAt !== null}
								>
									{pipeline.archivedAt !== null
										? `${pipeline.name} (archived)`
										: pipeline.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<div />
				)}
				<BoardDensityToggle density={density} onDensityChange={setDensity} />
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCorners}
				onDragStart={(event: DragStartEvent) =>
					setActiveId(String(event.active.id))
				}
				onDragEnd={handleDragEnd}
				onDragCancel={() => setActiveId(null)}
			>
				<div
					ref={panRef}
					{...panHandlers}
					className="flex min-h-0 flex-1 cursor-grab gap-3 overflow-x-auto pb-4 active:cursor-grabbing"
				>
					{columns.map((stage) => (
						<BoardColumn
							key={stage.id}
							stage={stage}
							rows={byStage.get(stage.id) ?? []}
							reportingCurrency={reportingCurrency}
							density={density}
							onOpen={(id) => openRecord({ kind: "deal", id })}
							onHover={(id) => prefetchRecord({ kind: "deal", id })}
						/>
					))}
				</div>
				<DragOverlay dropAnimation={null}>
					{activeRow ? (
						<DealCardBody row={activeRow} density={density} dragging />
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	);
}

function BoardColumn({
	stage,
	rows,
	reportingCurrency,
	density,
	onOpen,
	onHover,
}: {
	stage: Pipeline["stages"][number];
	rows: DealRow[];
	reportingCurrency: string;
	density: BoardDensity;
	onOpen: (id: string) => void;
	onHover: (id: string) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: stage.id });
	const total = rows.reduce((sum, row) => sum + (row.baseAmountCents ?? 0), 0);

	return (
		<div className="flex w-72 min-h-0 shrink-0 flex-col">
			<div className="mb-2 rounded-lg border border-border bg-card px-3 py-2.5">
				<div className="flex items-center justify-between">
					<span className="flex items-center gap-2 text-sm font-semibold text-foreground">
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: stage.color }}
						/>
						{stage.label}
					</span>
					<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
						{rows.length}
					</span>
				</div>
				<p className="mt-0.5 pl-4.5 text-xs text-muted-foreground">
					{formatMoney(total, reportingCurrency)}
				</p>
			</div>
			<div
				ref={setNodeRef}
				className={cn(
					"flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-1 transition-colors",
					isOver && "bg-accent/60 ring-2 ring-primary/30",
				)}
			>
				{rows.map((row) => (
					<DraggableDealCard
						key={row.id}
						row={row}
						density={density}
						onOpen={() => onOpen(row.id)}
						onHover={() => onHover(row.id)}
					/>
				))}
				{rows.length === 0 ? (
					<p className="px-1 py-6 text-center text-xs text-muted-foreground">
						No deals here.
					</p>
				) : null}
			</div>
		</div>
	);
}

function DraggableDealCard({
	row,
	density,
	onOpen,
	onHover,
}: {
	row: DealRow;
	density: BoardDensity;
	onOpen: () => void;
	onHover: () => void;
}) {
	const { setNodeRef, listeners, transform, isDragging } = useDraggable({
		id: row.id,
		data: { stageId: row.stage.id },
	});

	// Only the pointer `listeners` go on the wrapper — deliberately NOT the dnd
	// `attributes` (role=button / tabIndex), which would impose button semantics
	// on a card that already contains its own <button> and stage menu. Keyboard
	// stage changes stay on the accessible `DealStageMenu` inside the card.
	return (
		<div
			ref={setNodeRef}
			{...listeners}
			data-board-drag=""
			style={{
				transform: CSS.Translate.toString(transform),
				opacity: isDragging ? 0.4 : 1,
			}}
			className="cursor-grab touch-none select-none active:cursor-grabbing"
		>
			<DealCardBody
				row={row}
				density={density}
				onOpen={onOpen}
				onHover={onHover}
			/>
		</div>
	);
}

function DealCardBody({
	row,
	density = "comfortable",
	onOpen,
	onHover,
	dragging = false,
}: {
	row: DealRow;
	density?: BoardDensity;
	onOpen?: () => void;
	onHover?: () => void;
	dragging?: boolean;
}) {
	const compact = density === "compact";
	return (
		<div
			className={cn(
				"flex flex-col rounded-lg border border-border bg-card transition-colors hover:border-primary/40 hover:bg-accent/40",
				compact ? "gap-1 px-2 py-1.5" : "gap-2 px-3 py-2.5",
				dragging && "rotate-2 cursor-grabbing shadow-xl",
			)}
		>
			<button
				type="button"
				onClick={onOpen}
				onMouseEnter={onHover}
				className="flex flex-col gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<span className="flex items-start justify-between gap-2">
					<span className="min-w-0 truncate text-sm font-medium text-foreground">
						{row.name}
					</span>
					<span className="shrink-0 text-sm tabular-nums text-muted-foreground">
						{row.amountCents === null
							? "—"
							: formatMoney(row.amountCents, row.currency)}
					</span>
				</span>
			</button>
			{compact ? null : (
				<div className="flex items-center justify-between gap-2">
					<DealStageMenu dealId={row.id} stage={row.stage} />
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						{row.expectedCloseDate ? (
							<LocalDay date={row.expectedCloseDate} />
						) : null}
						<OwnerCell owner={row.owner} />
					</div>
				</div>
			)}
		</div>
	);
}
