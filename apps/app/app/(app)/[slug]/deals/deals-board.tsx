"use client";

import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CompanyCell } from "@/components/crm/company-cell";
import { OwnerCell } from "@/components/crm/owner-cell";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { DealStageMenu } from "@/components/crm/stage-change";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay } from "@/components/local-date-time";
import { DEAL_STAGE_OPTIONS, dealStageColor } from "@/lib/deal-stage";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { dealsSearchParams } from "./deals-search-params";

type DealRow = RouterOutputs["deals"]["list"]["rows"][number];

/**
 * Sales board — the v0-suite kanban (`design/v0-suite/components/jobs/kanban.tsx`)
 * ported onto the engine's real deal data layer. Columns are the live `DealStage`
 * enum (via `DEAL_STAGE_OPTIONS`), rows come from the same `deals.list` query the
 * table uses, so search / tab / facet filters carry over between views.
 *
 * Stage changes run through the existing `deals.setStage` mutation via the
 * per-card `DealStageMenu`. Pointer drag-and-drop between columns is the next
 * increment (needs the `@dnd-kit` dependency added to the app) — deliberately not
 * shipped here so this port lands with zero new dependencies and is fully
 * verifiable on its own.
 */
export function DealsBoard() {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const prefetchRecord = usePrefetchRecord();
	const { input } = useTableQuery(dealsSearchParams);

	const deals = useQuery({
		...trpc.deals.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const rows = deals.data?.rows ?? [];
	const reportingCurrency = deals.data?.reportingCurrency ?? "usd";

	const byStage = useMemo(() => {
		const map = new Map<string, DealRow[]>();
		for (const option of DEAL_STAGE_OPTIONS) map.set(option.value, []);
		for (const row of rows) map.get(row.stage)?.push(row);
		return map;
	}, [rows]);

	return (
		<div className="flex h-full min-h-0 gap-3 overflow-x-auto pb-4">
			{DEAL_STAGE_OPTIONS.map((option) => {
				const columnRows = byStage.get(option.value) ?? [];
				const total = columnRows.reduce(
					(sum, row) => sum + (row.baseAmountCents ?? 0),
					0,
				);
				return (
					<div key={option.value} className="flex w-72 shrink-0 flex-col">
						<div className="mb-2 rounded-lg border border-border bg-card px-3 py-2.5">
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-2 text-sm font-semibold text-foreground">
									<span
										className="h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: dealStageColor(option.value) }}
									/>
									{option.label}
								</span>
								<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
									{columnRows.length}
								</span>
							</div>
							<p className="mt-0.5 pl-4.5 text-xs text-muted-foreground">
								{formatMoney(total, reportingCurrency)}
							</p>
						</div>
						<div className="flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1">
							{columnRows.map((row) => (
								<DealCard
									key={row.id}
									row={row}
									onOpen={() => openRecord({ kind: "deal", id: row.id })}
									onHover={() => prefetchRecord({ kind: "deal", id: row.id })}
								/>
							))}
							{columnRows.length === 0 ? (
								<p className="px-1 py-6 text-center text-xs text-muted-foreground">
									No deals here.
								</p>
							) : null}
						</div>
					</div>
				);
			})}
		</div>
	);
}

function DealCard({
	row,
	onOpen,
	onHover,
}: {
	row: DealRow;
	onOpen: () => void;
	onHover: () => void;
}) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40">
			{/* Open-record affordance: a real <button> wrapping only non-interactive
			    content (name/amount/company), so the stage menu below can stay a
			    sibling control without nesting a button inside a button. */}
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
