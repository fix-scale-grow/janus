"use client";

import type { DealStage } from "@crm/db/enums";
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
import { usePanScroll } from "@/components/board/use-pan-scroll";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { DealStageMenu } from "@/components/crm/stage-change";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay } from "@/components/local-date-time";
import {
	DEAL_STAGE_OPTIONS,
	dealStageColor,
	LOSING_STAGES,
} from "@/lib/deal-stage";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { dealsSearchParams } from "./deals-search-params";

type DealsList = RouterOutputs["deals"]["list"];
type DealRow = DealsList["rows"][number];

/** Same nuqs keys the `DealStageMenu` uses, so a drag into a losing column drives
 * the globally-mounted `CloseReasonDialog` instead of moving silently. */
const closeReasonParams = {
	closing: parseAsString,
	closingStage: parseAsString,
};

const STAGE_VALUES = new Set<string>(DEAL_STAGE_OPTIONS.map((o) => o.value));

/** Move one row into `stage` inside a cached `deals.list` payload. Returns the
 * same reference when nothing changed so React-Query skips a needless render. */
function moveRowStage(
	data: DealsList | undefined,
	id: string,
	stage: DealStage,
): DealsList | undefined {
	if (!data) return data;
	let changed = false;
	const rows = data.rows.map((row) => {
		if (row.id === id && row.stage !== stage) {
			changed = true;
			return { ...row, stage };
		}
		return row;
	});
	return changed ? { ...data, rows } : data;
}

/**
 * Sales board — the v0-suite kanban (`design/v0-suite/components/jobs/kanban.tsx`)
 * ported onto the engine's real deal data layer. Columns are the live `DealStage`
 * enum (via `DEAL_STAGE_OPTIONS`), rows come from the same `deals.list` query the
 * table uses, so search / tab / facet filters carry over between views.
 *
 * Cards drag between columns (`@dnd-kit`). A drop runs the existing
 * `deals.setStage` mutation with an optimistic move + rollback; a drop into a
 * losing column routes through the shared `CloseReasonDialog` (via the same nuqs
 * params `DealStageMenu` uses) so a reason is still captured. The per-card
 * `DealStageMenu` stays as the keyboard-accessible path to the same mutation.
 */
export function DealsBoard() {
	const { ref: panRef, handlers: panHandlers } = usePanScroll<HTMLDivElement>();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();
	const { input } = useTableQuery(dealsSearchParams);
	const [, setCloseParams] = useQueryStates(closeReasonParams);
	const [activeId, setActiveId] = useState<string | null>(null);

	const sensors = useSensors(
		// Distance activation lets a plain click still open the record; only a
		// deliberate drag past 8px starts moving the card.
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const deals = useQuery({
		...trpc.deals.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const setStage = useMutation(
		trpc.deals.setStage.mutationOptions({
			onMutate: async ({ id, stage }) => {
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

	const byStage = useMemo(() => {
		const map = new Map<string, DealRow[]>();
		for (const option of DEAL_STAGE_OPTIONS) map.set(option.value, []);
		for (const row of rows) map.get(row.stage)?.push(row);
		return map;
	}, [rows]);

	const activeRow = activeId
		? (rows.find((row) => row.id === activeId) ?? null)
		: null;

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
		const overId = event.over?.id;
		if (overId == null) return;
		const target = String(overId);
		if (!STAGE_VALUES.has(target)) return;
		const nextStage = target as DealStage;
		const current = event.active.data.current?.stage as DealStage | undefined;
		if (!current || current === nextStage) return;
		const dealId = String(event.active.id);
		if (LOSING_STAGES.includes(nextStage)) {
			// Losing moves need a recorded reason — hand off to CloseReasonDialog.
			void setCloseParams({ closing: dealId, closingStage: nextStage });
			return;
		}
		setStage.mutate({ id: dealId, stage: nextStage });
	}

	return (
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
				{DEAL_STAGE_OPTIONS.map((option) => (
					<BoardColumn
						key={option.value}
						stage={option.value}
						label={option.label}
						rows={byStage.get(option.value) ?? []}
						reportingCurrency={reportingCurrency}
						onOpen={(id) => openRecord({ kind: "deal", id })}
						onHover={(id) => prefetchRecord({ kind: "deal", id })}
					/>
				))}
			</div>
			<DragOverlay dropAnimation={null}>
				{activeRow ? <DealCardBody row={activeRow} dragging /> : null}
			</DragOverlay>
		</DndContext>
	);
}

function BoardColumn({
	stage,
	label,
	rows,
	reportingCurrency,
	onOpen,
	onHover,
}: {
	stage: DealStage;
	label: string;
	rows: DealRow[];
	reportingCurrency: string;
	onOpen: (id: string) => void;
	onHover: (id: string) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: stage });
	const total = rows.reduce((sum, row) => sum + (row.baseAmountCents ?? 0), 0);

	return (
		<div className="flex w-72 min-h-0 shrink-0 flex-col">
			<div className="mb-2 rounded-lg border border-border bg-card px-3 py-2.5">
				<div className="flex items-center justify-between">
					<span className="flex items-center gap-2 text-sm font-semibold text-foreground">
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: dealStageColor(stage) }}
						/>
						{label}
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
	onOpen,
	onHover,
}: {
	row: DealRow;
	onOpen: () => void;
	onHover: () => void;
}) {
	const { setNodeRef, listeners, transform, isDragging } = useDraggable({
		id: row.id,
		data: { stage: row.stage },
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
			<DealCardBody row={row} onOpen={onOpen} onHover={onHover} />
		</div>
	);
}

function DealCardBody({
	row,
	onOpen,
	onHover,
	dragging = false,
}: {
	row: DealRow;
	onOpen?: () => void;
	onHover?: () => void;
	dragging?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40",
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
			<div className="flex items-center justify-between gap-2">
				<DealStageMenu dealId={row.id} stage={row.stage} />
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					{row.expectedCloseDate ? (
						<LocalDay date={row.expectedCloseDate} />
					) : null}
					<OwnerCell owner={row.owner} />
				</div>
			</div>
		</div>
	);
}
