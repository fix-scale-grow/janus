"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { formatMoney, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { BarTrend } from "@/components/dashboard-charts";
import {
	DrillTable,
	type DrillTableColumn,
} from "@/components/reports/drill-table";
import { ExcludedDisclosure } from "@/components/reports/excluded-disclosure";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { KpiRow } from "@/components/reports/kpi-row";
import { RangeControl } from "@/components/reports/range-control";
import { effectiveRange, reportRangeParsers } from "@/lib/reports/range";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Row = RouterOutputs["reports"]["jobProfitability"]["rows"][number] & {
	id: string;
};

const CHART_CONFIG: ChartConfig = {
	value: { label: "Profit", color: "var(--chart-1)" },
};

export function JobProfitabilityReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(
		trpc.reports.jobProfitability.queryOptions({ from, to }),
	);

	const rows: Row[] = (data?.rows ?? []).map((row) => ({
		...row,
		id: row.dealId,
	}));
	const hasData = rows.length > 0;

	const columns: DrillTableColumn<Row>[] = [
		{
			id: "deal",
			header: "Deal",
			width: "w-[22%]",
			render: (row) => (
				<RecordLink kind="deal" id={row.dealId} className="text-foreground">
					{row.dealName} #{row.dealNumber}
				</RecordLink>
			),
		},
		{
			id: "contact",
			header: "Client",
			width: "w-[16%]",
			render: (row) =>
				row.primaryContactId ? (
					<RecordLink kind="contact" id={row.primaryContactId}>
						{row.primaryContactName || "Unnamed contact"}
					</RecordLink>
				) : (
					<span className="text-muted-foreground">No contact</span>
				),
		},
		{
			id: "invoiced",
			header: "Invoiced",
			align: "right",
			width: "w-[11%]",
			render: (row) => formatMoney(row.invoicedCents, "USD"),
		},
		{
			id: "collected",
			header: "Collected",
			align: "right",
			width: "w-[11%]",
			render: (row) => formatMoney(row.collectedCents, "USD"),
		},
		{
			id: "costs",
			header: "Costs",
			align: "right",
			width: "w-[11%]",
			render: (row) => formatMoney(row.costsCents, "USD"),
		},
		{
			id: "profit",
			header: "Profit",
			align: "right",
			width: "w-[11%]",
			render: (row) => (
				<span className={row.profitCents < 0 ? "text-destructive" : undefined}>
					{formatMoney(row.profitCents, "USD")}
				</span>
			),
		},
		{
			id: "collectedProfit",
			header: "Collected profit",
			align: "right",
			width: "w-[12%]",
			render: (row) => (
				<span
					className={
						row.collectedProfitCents < 0 ? "text-destructive" : undefined
					}
				>
					{formatMoney(row.collectedProfitCents, "USD")}
				</span>
			),
		},
		{
			id: "margin",
			header: "Margin",
			align: "right",
			width: "w-[6%]",
			render: (row) =>
				row.marginPct === null ? "—" : formatPercent(row.marginPct / 100),
		},
	];

	const csvColumns = [
		{ key: "deal", label: "Deal" },
		{ key: "client", label: "Client" },
		{ key: "invoiced", label: "Invoiced" },
		{ key: "collected", label: "Collected" },
		{ key: "costs", label: "Costs" },
		{ key: "profit", label: "Profit" },
		{ key: "collectedProfit", label: "Collected profit" },
		{ key: "margin", label: "Margin" },
	];
	const csvRows = rows.map((row) => ({
		deal: `${row.dealName} #${row.dealNumber}`,
		client: row.primaryContactName || "",
		invoiced: formatMoney(row.invoicedCents, "USD"),
		collected: formatMoney(row.collectedCents, "USD"),
		costs: formatMoney(row.costsCents, "USD"),
		profit: formatMoney(row.profitCents, "USD"),
		collectedProfit: formatMoney(row.collectedProfitCents, "USD"),
		margin: row.marginPct === null ? "" : formatPercent(row.marginPct / 100),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="job-profitability.csv"
				/>
			</div>

			{hasData ? (
				<>
					<KpiRow kpis={data?.kpis ?? []} />
					<div className="rounded-lg border">
						<BarTrend
							data={(data?.series ?? []).map((point) => ({
								x: point.x,
								value: Number(point.value ?? 0),
							}))}
							config={CHART_CONFIG}
							xKey="x"
							height={260}
							formatValue={(value) => formatMoney(Number(value), "USD")}
						/>
					</div>
					<ExcludedDisclosure excluded={data?.excluded ?? 0} />
				</>
			) : null}

			<DrillTable<Row> columns={columns} rows={rows} />
		</div>
	);
}
