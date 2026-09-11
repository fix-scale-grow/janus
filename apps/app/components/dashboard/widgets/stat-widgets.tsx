"use client";

import { StatCard, type StatDelta } from "@crm/ui/components/stat-card";
import { WidgetShell } from "@crm/ui/components/widget-shell";
import { formatCount, formatMoneyCompact, formatPercent } from "@crm/ui/lib/format";
import {
	SummarySpinnerRow,
	useSummary,
	WidgetBoundary,
} from "@/components/dashboard/summary-context";

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
	const { summary, refetchSummary } = useSummary();
	const unconverted = summary?.unconverted;
	const reportingCurrency = summary?.reportingCurrency;

	return (
		<WidgetShell
			title="Closed won this month"
			description={
				unconverted && unconverted.count > 0 && reportingCurrency
					? `Every figure above is in ${reportingCurrency}. ${formatCount(unconverted.count, "deal")} in ${unconverted.currencies.join(", ")} ${unconverted.count === 1 ? "is" : "are"} not included — there is no rate to convert ${unconverted.currencies.length === 1 ? "it" : "them"} with.`
					: undefined
			}
		>
			<WidgetBoundary onRetry={refetchSummary}>
				<StatWonMonthBody />
			</WidgetBoundary>
		</WidgetShell>
	);
}

function StatWonMonthBody() {
	const { summary } = useSummary();
	if (!summary) return <SummarySpinnerRow />;

	const { wonThisMonth, wonPrevMonth, reportingCurrency } = summary;
	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);

	return (
		<div className="flex flex-1 items-center p-4 md:p-6">
			<StatCard
				className="p-0"
				value={money(wonThisMonth.valueCents)}
				delta={changeDelta(
					wonThisMonth.valueCents,
					wonPrevMonth.valueCents,
					"vs. last month",
				)}
				description={`${formatCount(wonThisMonth.count, "deal")} · ${money(wonPrevMonth.valueCents)} last month`}
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
	const { summary } = useSummary();
	if (!summary) return <SummarySpinnerRow />;

	const { pipeline, closingThisMonthTotal, reportingCurrency } = summary;
	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);

	return (
		<div className="flex flex-1 items-center p-4 md:p-6">
			<StatCard
				className="p-0"
				value={money(pipeline.totalCents)}
				description={`${formatCount(pipeline.totalDeals, "deal")} in progress · ${money(closingThisMonthTotal.valueCents)} due this month`}
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
	const { summary } = useSummary();
	if (!summary) return <SummarySpinnerRow />;

	const { performance } = summary;

	return (
		<div className="flex flex-1 items-center p-4 md:p-6">
			<StatCard
				className="p-0"
				label={`Win rate (${performance.windowDays}d)`}
				value={
					performance.winRate === null
						? "—"
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
	const { summary } = useSummary();
	if (!summary) return <SummarySpinnerRow />;

	const { performance, reportingCurrency } = summary;
	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);

	return (
		<div className="flex flex-1 items-center p-4 md:p-6">
			<StatCard
				className="p-0"
				label={`Average deal (${performance.windowDays}d)`}
				value={
					performance.avgDealCents === null
						? "—"
						: money(performance.avgDealCents)
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
