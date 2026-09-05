"use client";

import type { ProductionStage } from "@crm/db/enums";
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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePanScroll } from "@/components/board/use-pan-scroll";
import { CompanyCell } from "@/components/crm/company-cell";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { LocalDay } from "@/components/local-date-time";
import {
	PRODUCTION_COLUMNS,
	type ProductionColumn,
	productionStageColor,
	UNSCHEDULED,
	WON_JOBS_INPUT,
} from "@/lib/production-stage";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type DealsList = RouterOutputs["deals"]["list"];
type DealRow = DealsList["rows"][number];

const COLUMN_IDS = new Set<string>(PRODUCTION_COLUMNS.map((c) => String(c.id)));

/** The board column a row belongs to: its `productionStage`, or the Unscheduled
 * intake column when it has none yet. */
function columnOf(row: DealRow): ProductionColumn {
	return row.productionStage ?? UNSCHEDULED;
}

/** Move one won job into `column` inside a cached `deals.list` payload. A move
 * into Unscheduled clears the stage back to `null`. Returns the same reference
 * when nothing changed so React-Query skips a needless render. */
function moveRowColumn(
	data: DealsList | undefined,
	id: string,
	column: ProductionColumn,
): DealsList | undefined {
	if (!data) return data;
	const nextStage = column === UNSCHEDULED ? null : column;
	let changed = false;
	const rows = data.rows.map((row) => {
		if (row.id === id && row.productionStage !== nextStage) {
			changed = true;
			return { ...row, productionStage: nextStage };
		}
		return row;
	});
	return changed ? { ...data, rows } : data;
}

/**
 * Production board — the v0-suite production kanban
 * (`design/v0-suite/app/(app)/production/`) ported onto the engine's real deal
 * data layer. It reads the same `deals.list` query the sales board uses, but
 * pinned to won deals, and lays them out by the `productionStage` field.
 *
 * Cards drag between columns (`@dnd-kit`); a drop runs `deals.setProductionStage`
 * with an optimistic move + rollback. Dropping into "Unscheduled" clears the
 * stage. Clicking a card opens the deal record.
 */
export function ProductionBoard() {
	const { ref: panRef, handlers: panHandlers } = usePanScroll<HTMLDivElement>();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();
	const [activeId, setActiveId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const deals = useQuery({
		...trpc.deals.list.queryOptions(WON_JOBS_INPUT),
		placeholderData: (previous) => previous,
	});

	const setProductionStage = useMutation(
		trpc.deals.setProductionStage.mutationOptions({
			onMutate: async ({ id, stage }) => {
				const listKey = trpc.deals.list.pathKey();
				await queryClient.cancelQueries({ queryKey: listKey });
				const previous = queryClient.getQueriesData<DealsList>({
					queryKey: listKey,
				});
				const column: ProductionColumn = stage ?? UNSCHEDULED;
				queryClient.setQueriesData<DealsList>({ queryKey: listKey }, (data) =>
					moveRowColumn(data, id, column),
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

	const byColumn = useMemo(() => {
		const map = new Map<ProductionColumn, DealRow[]>();
		for (const column of PRODUCTION_COLUMNS) map.set(column.id, []);
		for (const row of rows) map.get(columnOf(row))?.push(row);
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
		if (!COLUMN_IDS.has(target)) return;
		const current = event.active.data.current?.column as
			| ProductionColumn
			| undefined;
		if (!current || current === target) return;
		const dealId = String(event.active.id);
		const nextStage =
			target === UNSCHEDULED ? null : (target as ProductionStage);
		setProductionStage.mutate({ id: dealId, stage: nextStage });
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
				{PRODUCTION_COLUMNS.map((column) => (
					<BoardColumn
						key={column.id}
						column={column.id}
						label={column.label}
						rows={byColumn.get(column.id) ?? []}
						reportingCurrency={reportingCurrency}
						onOpen={(id) => openRecord({ kind: "deal", id })}
						onHover={(id) => prefetchRecord({ kind: "deal", id })}
					/>
				))}
			</div>
			<DragOverlay dropAnimation={null}>
				{activeRow ? <JobCardBody row={activeRow} dragging /> : null}
			</DragOverlay>
		</DndContext>
	);
}

function BoardColumn({
	column,
	label,
	rows,
	reportingCurrency,
	onOpen,
	onHover,
}: {
	column: ProductionColumn;
	label: string;
	rows: DealRow[];
	reportingCurrency: string;
	onOpen: (id: string) => void;
	onHover: (id: string) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: column });
	const total = rows.reduce((sum, row) => sum + (row.baseAmountCents ?? 0), 0);

	return (
		<div className="flex w-72 min-h-0 shrink-0 flex-col">
			<div className="mb-2 rounded-lg border border-border bg-card px-3 py-2.5">
				<div className="flex items-center justify-between">
					<span className="flex items-center gap-2 text-sm font-semibold text-foreground">
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: productionStageColor(column) }}
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
					<DraggableJobCard
						key={row.id}
						row={row}
						column={column}
						onOpen={() => onOpen(row.id)}
						onHover={() => onHover(row.id)}
					/>
				))}
				{rows.length === 0 ? (
					<p className="px-1 py-6 text-center text-xs text-muted-foreground">
						No jobs here.
					</p>
				) : null}
			</div>
		</div>
	);
}

function DraggableJobCard({
	row,
	column,
	onOpen,
	onHover,
}: {
	row: DealRow;
	column: ProductionColumn;
	onOpen: () => void;
	onHover: () => void;
}) {
	const { setNodeRef, listeners, transform, isDragging } = useDraggable({
		id: row.id,
		data: { column },
	});

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
			<JobCardBody row={row} onOpen={onOpen} onHover={onHover} />
		</div>
	);
}

function JobCardBody({
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
				<CompanyCell company={row.company} />
			</button>
			<div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
				{row.expectedCloseDate ? (
					<LocalDay date={row.expectedCloseDate} />
				) : null}
				<OwnerCell owner={row.owner} />
			</div>
		</div>
	);
}
