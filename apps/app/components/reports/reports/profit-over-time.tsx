"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { BarTrend } from "@/components/dashboard-charts";
import {
	DrillTable,
	type DrillTableColumn,
} from "@/components/reports/drill-table";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { KpiRow } from "@/components/reports/kpi-row";
import { RangeControl } from "@/components/reports/range-control";
import { effectiveRange, reportRangeParsers } from "@/lib/reports/range";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Row = RouterOutputs["reports"]["profitOverTime"]["rows"][number] & {
	id: string;
};

const CHART_CONFIG: ChartConfig = {
	invoicedCents: { label: "Invoiced", color: "var(--chart-1)" },
	collectedCents: { label: "Collected", color: "var(--chart-2)" },
	costsCents: { label: "Costs", color: "var(--chart-3)" },
};

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-US", {
	month: "short",
	year: "2-digit",
});

function formatMonthLabel(month: string): string {
	const [year, monthIndex] = month.split("-").map(Number);
	if (!year || !monthIndex) return month;
	return MONTH_LABEL_FORMAT.format(new Date(year, monthIndex - 1, 1));
}

export function ProfitOverTimeReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(
		trpc.reports.profitOverTime.queryOptions({ from, to }),
	);

	const rows: Row[] = (data?.rows ?? []).map((row) => ({
		...row,
		id: row.month,
	}));
	const hasData = rows.some(
		(row) =>
			row.invoicedCents !== 0 ||
			row.collectedCents !== 0 ||
			row.costsCents !== 0,
	);

	const columns: DrillTableColumn<Row>[] = [
		{
			id: "month",
			header: "Month",
			width: "w-[25%]",
			render: (row) => formatMonthLabel(row.month),
		},
		{
			id: "invoiced",
			header: "Invoiced",
			align: "right",
			width: "w-[25%]",
			render: (row) => formatMoney(row.invoicedCents, "USD"),
		},
		{
			id: "collected",
			header: "Collected",
			align: "right",
			width: "w-[25%]",
			render: (row) => formatMoney(row.collectedCents, "USD"),
		},
		{
			id: "costs",
			header: "Costs",
			align: "right",
			width: "w-[25%]",
			render: (row) => (
				<span
					className={cn(
						row.invoicedCents - row.costsCents < 0 && "text-destructive",
					)}
				>
					{formatMoney(row.costsCents, "USD")}
				</span>
			),
		},
	];

	const csvColumns = [
		{ key: "month", label: "Month" },
		{ key: "invoiced", label: "Invoiced" },
		{ key: "collected", label: "Collected" },
		{ key: "costs", label: "Costs" },
	];
	const csvRows = rows.map((row) => ({
		month: formatMonthLabel(row.month),
		invoiced: formatMoney(row.invoicedCents, "USD"),
		collected: formatMoney(row.collectedCents, "USD"),
		costs: formatMoney(row.costsCents, "USD"),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="profit-over-time.csv"
				/>
			</div>

			{hasData ? (
				<>
					<KpiRow kpis={data?.kpis ?? []} />
					<div className="rounded-lg border">
						<BarTrend
							data={(data?.series ?? []).map((point) => ({
								x: point.x,
								invoicedCents: Number(point.invoicedCents ?? 0),
								collectedCents: Number(point.collectedCents ?? 0),
								costsCents: Number(point.costsCents ?? 0),
							}))}
							config={CHART_CONFIG}
							xKey="x"
							height={280}
							showLegend
							formatX={formatMonthLabel}
							formatValue={(value) => formatMoney(Number(value), "USD")}
						/>
					</div>
				</>
			) : null}

			<DrillTable<Row> columns={columns} rows={hasData ? rows : []} />
		</div>
	);
}
