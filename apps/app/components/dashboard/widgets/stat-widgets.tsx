"use client";

import { StatCard, type StatDelta } from "@crm/ui/components/stat-card";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import {
	formatCount,
	formatPercent,
	formatUsdCompact,
} from "@crm/ui/lib/format";
import {
	SummarySpinnerRow,
	useSummary,
	WidgetBoundary,
} from "@/components/dashboard/summary-context";
import { useAccess } from "@/lib/access";

function changeDelta(
	current: number,
	previous: number,
	label: string,
): StatDelta | undefined {
	if (previous === 0) return undefined;
	const change = Math.round(((current - previous) / previous) * 100);
	return {
		value: `${change >= 0 ? "+" : ""}${change}%`,
		direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
		label,
	};
}

export function StatWonMonthWidget() {
	const { refetchSummary } = useSummary();

	return (
		<WidgetShell title="Closed won this month">
			<WidgetBoundary onRetry={refetchSummary}>
				<StatWonMonthBody />
			</WidgetBoundary>
		</WidgetShell>
	);
}

function StatWonMonthBody() {
	const { summary, isError, refetchSummary } = useSummary();
	if (!summary) {
		return isError ? (
			<WidgetError onRetry={refetchSummary} />
		) : (
			<SummarySpinnerRow />
		);
	}

	const { wonThisMonth, wonPrevMonth } = summary;
	const money = formatUsdCompact;
	const thisMonthCents = wonThisMonth.valueCents;
	const prevMonthCents = wonPrevMonth.valueCents;

	return (
		<div className="flex min-h-0 flex-1 items-center px-4 md:px-6">
			<StatCard
				className="p-0 md:p-0"
				value={thisMonthCents === null ? "Hidden" : money(thisMonthCents)}
				delta={
					thisMonthCents === null || prevMonthCents === null
						? undefined
						: changeDelta(thisMonthCents, prevMonthCents, "vs. last month")
				}
				description={
					prevMonthCents === null
						? `${formatCount(wonThisMonth.count, "deal")}`
						: `${formatCount(wonThisMonth.count, "deal")} · ${money(prevMonthCents)} last month`
				}
			/>
		</div>
	);
}

export function StatOpenPipelineWidget() {
	const { refetchSummary } = useSummary();
	return (
		<WidgetShell title="Open pipeline">
			<WidgetBoundary onRetry={refetchSummary}>
				<StatOpenPipelineBody />
			</WidgetBoundary>
		</WidgetShell>
	);
}

function StatOpenPipelineBody() {
	const { summary, isError, refetchSummary } = useSummary();
	if (!summary) {
		return isError ? (
			<WidgetError onRetry={refetchSummary} />
		) : (
			<SummarySpinnerRow />
		);
	}

	const { pipeline, closingThisMonthTotal } = summary;
	const money = formatUsdCompact;
	const totalCents = pipeline.totalCents;
	const closingCents = closingThisMonthTotal.valueCents;

	return (
		<div className="flex min-h-0 flex-1 items-center px-4 md:px-6">
			<StatCard
				className="p-0 md:p-0"
				value={totalCents === null ? "Hidden" : money(totalCents)}
				description={
					closingCents === null
						? `${formatCount(pipeline.totalDeals, "deal")} in progress`
						: `${formatCount(pipeline.totalDeals, "deal")} in progress · ${money(closingCents)} due this month`
				}
			/>
		</div>
	);
}

export function StatWinRateWidget() {
	const { refetchSummary } = useSummary();
	return (
		<WidgetShell title="Win rate">
			<WidgetBoundary onRetry={refetchSummary}>
				<StatWinRateBody />
			</WidgetBoundary>
		</WidgetShell>
	);
}

function StatWinRateBody() {
	const { summary, isError, refetchSummary } = useSummary();
	const { mine, money } = useAccess();
	if (!summary) {
		return isError ? (
			<WidgetError onRetry={refetchSummary} />
		) : (
			<SummarySpinnerRow />
		);
	}

	const { performance } = summary;
	const pricesHidden = Boolean(mine) && !money("prices");

	return (
		<div className="flex min-h-0 flex-1 items-center px-4 md:px-6">
			<StatCard
				className="p-0 md:p-0"
				label={`Win rate (${performance.windowDays}d)`}
				value={
					performance.winRate === null
						? pricesHidden
							? "Hidden"
							: "—"
						: formatPercent(performance.winRate)
				}
				description={
					performance.wins + performance.losses === 0
						? "Nothing has closed yet"
						: `${performance.wins} won · ${performance.losses} lost`
				}
			/>
		</div>
	);
}

export function StatAvgDealWidget() {
	const { refetchSummary } = useSummary();
	return (
		<WidgetShell title="Average deal">
			<WidgetBoundary onRetry={refetchSummary}>
				<StatAvgDealBody />
			</WidgetBoundary>
		</WidgetShell>
	);
}

function StatAvgDealBody() {
	const { summary, isError, refetchSummary } = useSummary();
	const { mine, money } = useAccess();
	if (!summary) {
		return isError ? (
			<WidgetError onRetry={refetchSummary} />
		) : (
			<SummarySpinnerRow />
		);
	}

	const { performance } = summary;
	const formatCents = formatUsdCompact;
	const pricesHidden = Boolean(mine) && !money("prices");

	return (
		<div className="flex min-h-0 flex-1 items-center px-4 md:px-6">
			<StatCard
				className="p-0 md:p-0"
				label={`Average deal (${performance.windowDays}d)`}
				value={
					performance.avgDealCents === null
						? pricesHidden
							? "Hidden"
							: "—"
						: formatCents(performance.avgDealCents)
				}
				description={
					performance.avgCycleDays === null
						? "No wins to measure"
						: `${performance.avgCycleDays}-day average cycle`
				}
			/>
		</div>
	);
}
