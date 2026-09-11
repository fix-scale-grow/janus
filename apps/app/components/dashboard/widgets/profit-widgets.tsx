"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { Spinner } from "@crm/ui/components/spinner";
import { WidgetShell } from "@crm/ui/components/widget-shell";
import { formatMoneyCompact } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { BarTrend } from "@/components/dashboard-charts";
import { ValueMeter } from "@/components/dashboard/widgets/deals-open-widget";
import { WidgetBoundary } from "@/components/dashboard/summary-context";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type MonthRow = RouterOutputs["reports"]["byMonth"]["rows"][number];
type CategoryRow = RouterOutputs["reports"]["byCategory"]["rows"][number];
type Category = CategoryRow["category"];

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

function mostActiveCurrency(rows: { currency: string }[]): string | undefined {
	const counts = new Map<string, number>();
	for (const row of rows) {
		counts.set(row.currency, (counts.get(row.currency) ?? 0) + 1);
	}
	let best: string | undefined;
	let bestCount = -1;
	for (const [currency, count] of counts) {
		if (count > bestCount) {
			best = currency;
			bestCount = count;
		}
	}
	return best;
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
	const query = useQuery(trpc.reports.byMonth.queryOptions());

	return (
		<WidgetShell
			title="Profit by month"
			description="Invoiced minus costs, over the last six months"
		>
			<WidgetBoundary onRetry={() => query.refetch()}>
				{query.data ? <ProfitByMonthBody rows={query.data.rows} /> : <LoadingRow />}
			</WidgetBoundary>
		</WidgetShell>
	);
}

function ProfitByMonthBody({ rows }: { rows: MonthRow[] }) {
	const nonZero = rows.filter(
		(row) => row.invoicedCents !== 0 || row.costsCents !== 0,
	);
	const currency = mostActiveCurrency(nonZero);
	const chartRows = currency
		? rows.filter((row) => row.currency === currency)
		: [];

	if (!currency || chartRows.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
				No activity in the last six months
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col justify-center py-4">
			<BarTrend
				data={chartRows.map((row) => ({
					month: row.month,
					profitCents: row.profitCents,
				}))}
				config={MONTH_CHART_CONFIG}
				xKey="month"
				height={196}
				formatValue={(value) => formatMoneyCompact(Number(value), currency)}
			/>
		</div>
	);
}

export function CostsByCategoryWidget() {
	const trpc = useTRPC();
	const query = useQuery(trpc.reports.byCategory.queryOptions({}));

	return (
		<WidgetShell
			title="Costs by category"
			description="Spend over the last six months, by category"
		>
			<WidgetBoundary onRetry={() => query.refetch()}>
				{query.data ? <CostsByCategoryBody rows={query.data.rows} /> : <LoadingRow />}
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

	const currency = mostActiveCurrency(rows) ?? rows[0]?.currency;
	const filtered = currency
		? rows.filter((row) => row.currency === currency)
		: rows;
	const total = filtered.reduce((sum, row) => sum + row.totalCents, 0);

	return (
		<ul className="flex flex-col px-5 pb-1 md:px-6">
			{filtered.map((row) => (
				<li
					key={`${row.category}-${row.currency}`}
					className="flex items-center gap-2.5 border-t py-2 first:border-t-0"
				>
					<span className="min-w-0 flex-1 truncate text-xs">
						{CATEGORY_LABEL[row.category]}
					</span>
					<span className="w-24 shrink-0">
						<ValueMeter
							share={total > 0 ? (row.totalCents / total) * 100 : 0}
							color={CATEGORY_COLOR[row.category]}
						/>
					</span>
					<span className="w-16 shrink-0 text-right font-medium text-xs tabular-nums">
						{formatMoneyCompact(row.totalCents, row.currency)}
					</span>
				</li>
			))}
		</ul>
	);
}
