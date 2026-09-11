"use client";

import { Button } from "@crm/ui/components/button";
import { CardPanel, CardPanelEmpty } from "@crm/ui/components/card";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import { formatMoneyCompact } from "@crm/ui/lib/format";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { DealStageIndicator } from "@/components/crm/deal-stage";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import {
	type Summary,
	SummarySpinnerRow,
	useSummary,
	WidgetBoundary,
} from "@/components/dashboard/summary-context";
import { LocalRelativeTime } from "@/components/local-date-time";
import { stageColor } from "@/lib/stage-presentation";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const CELL = "px-3 py-2.5 align-middle";

const OPEN_COLUMNS: SimpleTableColumn[] = [
	{ id: "deal", header: "Deal" },
	{
		id: "stage",
		header: "Stage",
		width: "w-32",
		className: "hidden lg:table-cell",
	},
	{
		id: "share",
		srLabel: "Share of the largest",
		width: "w-24",
		className: "hidden sm:table-cell",
	},
	{ id: "value", header: "Value", width: "w-20", align: "right" },
];

type BiggestOpenDeal = Summary["biggestOpen"][number];

export function DealsOpenWidget() {
	const workspaceUrl = useWorkspaceUrl();
	const { summary, isError, refetchSummary } = useSummary();

	return (
		<WidgetShell
			title="Deals in progress"
			description="The largest open deals, and how long each has sat in its stage"
			action={
				<Button asChild variant="contrast" size="sm">
					<Link href={workspaceUrl("/deals")}>Open deals</Link>
				</Button>
			}
		>
			<WidgetBoundary onRetry={refetchSummary}>
				{summary ? (
					<DealsOpenBody biggestOpen={summary.biggestOpen} />
				) : isError ? (
					<WidgetError onRetry={refetchSummary} />
				) : (
					<SummarySpinnerRow />
				)}
			</WidgetBoundary>
		</WidgetShell>
	);
}

function DealsOpenBody({ biggestOpen }: { biggestOpen: BiggestOpenDeal[] }) {
	const openRecord = useOpenRecord();
	const largestOpenCents = biggestOpen[0]?.baseAmountCents ?? 0;

	if (biggestOpen.length === 0) {
		return (
			<CardPanelEmpty>Nothing open. Time to fill the pipeline.</CardPanelEmpty>
		);
	}

	return (
		<CardPanel>
			<SimpleTable variant="panel" surface="page" columns={OPEN_COLUMNS}>
				{biggestOpen.map((deal) => (
					<SimpleTableRow
						key={deal.id}
						clickable
						onClick={() => openRecord({ kind: "deal", id: deal.id })}
					>
						<TableCell className={CELL}>
							<DealCell
								name={deal.name}
								meta={<LocalRelativeTime date={deal.stageChangedAt} />}
							/>
						</TableCell>
						<TableCell className={`${CELL} hidden lg:table-cell`}>
							<DealStageIndicator stage={deal.stage} />
						</TableCell>
						<TableCell className={`${CELL} hidden sm:table-cell`}>
							<ValueMeter
								share={
									largestOpenCents > 0
										? ((deal.baseAmountCents ?? 0) / largestOpenCents) * 100
										: 0
								}
								color={stageColor(deal.stage)}
							/>
						</TableCell>
						<TableCell className={`${CELL} text-right tabular-nums`}>
							{deal.amountCents === null ? (
								<EmptyCellValue />
							) : (
								formatMoneyCompact(deal.amountCents, deal.currency)
							)}
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
		</CardPanel>
	);
}

export function DealCell({ name, meta }: { name: string; meta?: ReactNode }) {
	return (
		<span className="flex min-w-0 flex-col">
			<span className="truncate font-medium">{name}</span>
			{meta ? (
				<span className="truncate text-muted-foreground">{meta}</span>
			) : null}
		</span>
	);
}

export function ValueMeter({ share, color }: { share: number; color: string }) {
	return (
		<span
			className="bloom-low flex h-1.5 w-full overflow-hidden bg-muted"
			style={{ "--bloom-color": color } as CSSProperties}
		>
			<span
				className="h-full w-(--share)"
				style={
					{
						backgroundColor: color,
						"--share": `${Math.round(Math.max(Math.min(share, 100), 0))}%`,
					} as CSSProperties
				}
			/>
		</span>
	);
}
