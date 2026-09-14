"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { formatMoney } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { BarTrend } from "@/components/dashboard-charts";
import { LocalDay } from "@/components/local-date-time";
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
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Row = RouterOutputs["reports"]["arAging"]["rows"][number] & {
	id: string;
};

const CHART_CONFIG: ChartConfig = {
	value: { label: "Outstanding", color: "var(--chart-1)" },
};

const BUCKET_LABEL: Record<string, string> = {
	current: "Current",
	"1-30": "1-30 days",
	"31-60": "31-60 days",
	"61-90": "61-90 days",
	"90+": "90+ days",
};

function bucketLabel(bucket: string): string {
	return BUCKET_LABEL[bucket] ?? bucket;
}

export function ArAgingReport() {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(trpc.reports.arAging.queryOptions({ from, to }));

	const rows: Row[] = (data?.rows ?? []).map((row) => ({
		...row,
		id: row.invoiceId,
	}));
	const hasData = rows.length > 0;

	const columns: DrillTableColumn<Row>[] = [
		{
			id: "invoice",
			header: "Invoice",
			width: "w-[14%]",
			render: (row) => (
				<Link
					href={workspaceUrl(`/invoices/${row.invoiceId}`)}
					className="text-foreground hover:underline"
				>
					#{row.number}
				</Link>
			),
		},
		{
			id: "deal",
			header: "Deal",
			width: "w-[26%]",
			render: (row) =>
				row.dealId && row.dealName ? (
					<RecordLink kind="deal" id={row.dealId}>
						{row.dealName}
					</RecordLink>
				) : (
					<span className="text-muted-foreground">No deal</span>
				),
		},
		{
			id: "dueAt",
			header: "Due",
			width: "w-[15%]",
			render: (row) => <LocalDay date={row.dueAt} />,
		},
		{
			id: "age",
			header: "Age",
			align: "right",
			width: "w-[10%]",
			render: (row) => `${row.ageDays}d`,
		},
		{
			id: "bucket",
			header: "Bucket",
			width: "w-[15%]",
			render: (row) => (
				<span className={cn(row.bucket !== "current" && "text-warning")}>
					{bucketLabel(row.bucket)}
				</span>
			),
		},
		{
			id: "total",
			header: "Total",
			align: "right",
			width: "w-[20%]",
			render: (row) => formatMoney(row.totalCents, "USD"),
		},
	];

	const csvColumns = [
		{ key: "invoice", label: "Invoice" },
		{ key: "deal", label: "Deal" },
		{ key: "dueAt", label: "Due" },
		{ key: "age", label: "Age (days)" },
		{ key: "bucket", label: "Bucket" },
		{ key: "total", label: "Total" },
	];
	const csvRows = rows.map((row) => ({
		invoice: `#${row.number}`,
		deal: row.dealName ?? "",
		dueAt: row.dueAt.slice(0, 10),
		age: row.ageDays,
		bucket: bucketLabel(row.bucket),
		total: formatMoney(row.totalCents, "USD"),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="ar-aging.csv"
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
							height={240}
							formatX={bucketLabel}
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
