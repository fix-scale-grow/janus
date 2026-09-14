"use client";

import { formatMoney, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { DonutStat } from "@/components/dashboard-charts";
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

type CategoryRow = RouterOutputs["reports"]["costBreakdown"]["rows"][number] & {
	id: string;
};
type DealRow = RouterOutputs["reports"]["costBreakdown"]["byDeal"][number] & {
	id: string;
};
type CreatorRow =
	RouterOutputs["reports"]["costBreakdown"]["byCreator"][number] & {
		id: string;
	};

const CATEGORY_LABEL: Record<string, string> = {
	MATERIALS: "Materials",
	LABOR: "Labor",
	SUBCONTRACTOR: "Subcontractor",
	EQUIPMENT: "Equipment",
	PERMITS_FEES: "Permits & fees",
	OTHER: "Other",
};

const CATEGORY_COLOR: Record<string, string> = {
	MATERIALS: "var(--chart-1)",
	LABOR: "var(--chart-2)",
	SUBCONTRACTOR: "var(--chart-3)",
	EQUIPMENT: "var(--chart-4)",
	PERMITS_FEES: "var(--chart-5)",
	OTHER: "var(--muted-foreground)",
};

function categoryLabel(category: string): string {
	return CATEGORY_LABEL[category] ?? category;
}

export function CostBreakdownReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(
		trpc.reports.costBreakdown.queryOptions({ from, to }),
	);

	const categoryRows: CategoryRow[] = (data?.rows ?? []).map((row) => ({
		...row,
		id: row.category,
	}));
	const dealRows: DealRow[] = (data?.byDeal ?? []).map((row) => ({
		...row,
		id: row.dealId,
	}));
	const creatorRows: CreatorRow[] = (data?.byCreator ?? []).map((row) => ({
		...row,
		id: row.creatorId,
	}));
	const hasData = categoryRows.length > 0;
	const totalCents = categoryRows.reduce((sum, row) => sum + row.totalCents, 0);

	const categoryColumns: DrillTableColumn<CategoryRow>[] = [
		{
			id: "category",
			header: "Category",
			width: "w-[40%]",
			render: (row) => categoryLabel(row.category),
		},
		{
			id: "total",
			header: "Total",
			align: "right",
			width: "w-[30%]",
			render: (row) => formatMoney(row.totalCents, "USD"),
		},
		{
			id: "share",
			header: "% of total",
			align: "right",
			width: "w-[30%]",
			render: (row) =>
				totalCents > 0 ? formatPercent(row.totalCents / totalCents) : "—",
		},
	];

	const dealColumns: DrillTableColumn<DealRow>[] = [
		{
			id: "deal",
			header: "Deal",
			width: "w-[60%]",
			render: (row) => (
				<RecordLink kind="deal" id={row.dealId} className="text-foreground">
					{row.dealName}
				</RecordLink>
			),
		},
		{
			id: "total",
			header: "Total",
			align: "right",
			width: "w-[40%]",
			render: (row) => formatMoney(row.totalCents, "USD"),
		},
	];

	const creatorColumns: DrillTableColumn<CreatorRow>[] = [
		{
			id: "creator",
			header: "Logged by",
			width: "w-[60%]",
			render: (row) => row.creatorName,
		},
		{
			id: "total",
			header: "Total",
			align: "right",
			width: "w-[40%]",
			render: (row) => formatMoney(row.totalCents, "USD"),
		},
	];

	const csvColumns = [
		{ key: "category", label: "Category" },
		{ key: "total", label: "Total" },
		{ key: "share", label: "% of total" },
	];
	const csvRows = categoryRows.map((row) => ({
		category: categoryLabel(row.category),
		total: formatMoney(row.totalCents, "USD"),
		share: totalCents > 0 ? formatPercent(row.totalCents / totalCents) : "",
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="cost-breakdown.csv"
				/>
			</div>

			{hasData ? (
				<>
					<KpiRow kpis={data?.kpis ?? []} />
					<div className="rounded-lg border p-4">
						<DonutStat
							data={categoryRows.map((row) => ({
								key: row.category,
								label: categoryLabel(row.category),
								value: row.totalCents,
								color: CATEGORY_COLOR[row.category] ?? "var(--chart-1)",
							}))}
							height={220}
							centerValue={formatMoney(totalCents, "USD")}
							centerLabel="Total costs"
							formatValue={(value) => formatMoney(Number(value), "USD")}
						/>
					</div>
					<ExcludedDisclosure excluded={data?.excluded ?? 0} />
				</>
			) : null}

			<div className="flex flex-col gap-6">
				<DrillTable<CategoryRow>
					columns={categoryColumns}
					rows={categoryRows}
				/>
				<DrillTable<DealRow>
					columns={dealColumns}
					rows={dealRows}
					emptyTitle="No data in this range"
				/>
				<DrillTable<CreatorRow>
					columns={creatorColumns}
					rows={creatorRows}
					emptyTitle="No data in this range"
				/>
			</div>
		</div>
	);
}
