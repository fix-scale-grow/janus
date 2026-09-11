"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import { formatMoney } from "@crm/ui/lib/format";
import {
	SummarySpinnerRow,
	useSummary,
	WidgetBoundary,
} from "@/components/dashboard/summary-context";
import { AreaTrend } from "@/components/dashboard-charts";

const TREND_CONFIG: ChartConfig = {
	won: { label: "Closed won", color: "var(--success)" },
	created: { label: "New pipeline", color: "var(--chart-1)" },
};

export function TrendWidget() {
	const { refetchSummary } = useSummary();
	return (
		<WidgetShell
			title="Closed won vs. new pipeline"
			description="Last six months, by the month a deal closed or was created"
		>
			<WidgetBoundary onRetry={refetchSummary}>
				<TrendBody />
			</WidgetBoundary>
		</WidgetShell>
	);
}

function TrendBody() {
	const { summary, isError, refetchSummary } = useSummary();
	if (!summary) {
		return isError ? (
			<WidgetError onRetry={refetchSummary} />
		) : (
			<SummarySpinnerRow />
		);
	}

	const { trend, reportingCurrency } = summary;
	const exact = (value: unknown) =>
		formatMoney(
			typeof value === "number" ? value : Number(value),
			reportingCurrency,
		);
	const hasTrend = trend.some((point) => point.won > 0 || point.created > 0);

	if (!hasTrend) {
		return (
			<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
				No deals closed or created yet
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col justify-center py-4">
			<AreaTrend
				data={trend}
				config={TREND_CONFIG}
				xKey="month"
				height={196}
				variant="gradient"
				bloom="high"
				showLegend
				formatValue={exact}
			/>
		</div>
	);
}
