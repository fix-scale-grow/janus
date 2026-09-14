"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { Spinner } from "@crm/ui/components/spinner";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import { formatMoneyCompact } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { WidgetBoundary } from "@/components/dashboard/summary-context";
import { ValueMeter } from "@/components/dashboard/widgets/deals-open-widget";
import { BarTrend } from "@/components/dashboard-charts";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type MonthRow = RouterOutputs["reports"]["profitOverTime"]["rows"][number];
type CategoryRow = RouterOutputs["reports"]["costBreakdown"]["rows"][number];
type Category = CategoryRow["category"];

const WIDGET_TRAILING_MONTHS = 6;

const MONTH_CHART_CONFIG: ChartConfig = {
	profitCents: { label: "Profit", color: "var(--chart-3)" },
};

const CATEGORY_LABEL: Record<Category, string> = {
	MATERIALS: "Materials",
	LABOR: "Labor",
	SUBCONTRACTOR: "Subcontractor",
	EQUIPMENT: "Equipment",
	PERMITS_FEES: "Permits & fees",
	OTHER: "Other",
};

const CATEGORY_COLOR: Record<Category, string> = {
	MATERIALS: "var(--chart-1)",
	LABOR: "var(--chart-2)",
	SUBCONTRACTOR: "var(--chart-3)",
	EQUIPMENT: "var(--chart-4)",
	PERMITS_FEES: "var(--chart-5)",
	OTHER: "var(--muted-foreground)",
};

function sixMonthRange(): { from: Date; to: Date } {
	const to = new Date();
	const from = new Date(
		Date.UTC(
			to.getUTCFullYear(),
			to.getUTCMonth() - (WIDGET_TRAILING_MONTHS - 1),
			1,
		),
	);
	return { from, to };
}

function LoadingRow() {
	return (
		<div className="flex flex-1 items-center justify-center py-12">
			<Spinner />
		</div>
	);
}

export function ProfitByMonthWidget() {
	const trpc = useTRPC();
	const range = useMemo(sixMonthRange, []);
	const query = useQuery(trpc.reports.profitOverTime.queryOptions(range));

	return (
		<WidgetShell
			title="Profit by month"
			description="Invoiced minus costs, over the last six months"
		>
			<WidgetBoundary onRetry={() => query.refetch()}>
				{query.data ? (
					<ProfitByMonthBody rows={query.data.rows} />
				) : query.isError ? (
					<WidgetError onRetry={() => query.refetch()} />
				) : (
					<LoadingRow />
				)}
			</WidgetBoundary>
		</WidgetShell>
	);
}

function ProfitByMonthBody({ rows }: { rows: MonthRow[] }) {
	const chartRows = rows.map((row) => ({
		month: row.month,
		profitCents: row.invoicedCents - row.costsCents,
	}));
	const hasActivity = rows.some(
		(row) => row.invoicedCents !== 0 || row.costsCents !== 0,
	);

	if (!hasActivity) {
		return (
			<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
				No activity in the last six months
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col justify-center py-4">
			<BarTrend
				data={chartRows}
				config={MONTH_CHART_CONFIG}
				xKey="month"
				height={196}
				formatValue={(value) => formatMoneyCompact(Number(value), "USD")}
			/>
		</div>
	);
}

export function CostsByCategoryWidget() {
	const trpc = useTRPC();
	const range = useMemo(sixMonthRange, []);
	const query = useQuery(trpc.reports.costBreakdown.queryOptions(range));

	return (
		<WidgetShell
			title="Costs by category"
			description="Spend over the last six months, by category"
		>
			<WidgetBoundary onRetry={() => query.refetch()}>
				{query.data ? (
					<CostsByCategoryBody rows={query.data.rows} />
				) : query.isError ? (
					<WidgetError onRetry={() => query.refetch()} />
				) : (
					<LoadingRow />
				)}
			</WidgetBoundary>
		</WidgetShell>
	);
}

function CostsByCategoryBody({ rows }: { rows: CategoryRow[] }) {
	if (rows.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
				No costs in this range
			</div>
		);
	}

	const total = rows.reduce((sum, row) => sum + row.totalCents, 0);

	return (
		<ul className="flex flex-col px-5 pb-1 md:px-6">
			{rows.map((row) => (
				<li
					key={row.category}
					className="flex items-center gap-2.5 border-t py-2 first:border-t-0"
				>
					<span className="min-w-0 flex-1 truncate text-xs">
						{CATEGORY_LABEL[row.category] ?? row.category}
					</span>
					<span className="w-24 shrink-0">
						<ValueMeter
							share={total > 0 ? (row.totalCents / total) * 100 : 0}
							color={CATEGORY_COLOR[row.category] ?? "var(--muted-foreground)"}
						/>
					</span>
					<span className="w-16 shrink-0 text-right font-medium text-xs tabular-nums">
						{formatMoneyCompact(row.totalCents, "USD")}
					</span>
				</li>
			))}
		</ul>
	);
}
