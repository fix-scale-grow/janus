"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { formatMoney, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
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

type Row = RouterOutputs["reports"]["leaderboard"]["rows"][number] & {
	id: string;
};

export function LeaderboardReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(
		trpc.reports.leaderboard.queryOptions({ from, to }),
	);

	const rows: Row[] = (data?.rows ?? []).map((row) => ({
		...row,
		id: row.userId,
	}));
	const hasData = rows.length > 0;
	const moneyVisible = rows.some((row) => row.wonCents !== null);

	const chartConfig: ChartConfig = {
		value: {
			label: moneyVisible ? "Won value" : "Won count",
			color: "var(--chart-1)",
		},
	};

	const columns: DrillTableColumn<Row>[] = [
		{
			id: "owner",
			header: "Owner",
			width: "w-[22%]",
			render: (row) => row.name,
		},
		{
			id: "wonCount",
			header: "Deals won",
			align: "right",
			width: "w-[13%]",
			render: (row) => String(row.wonCount),
		},
		{
			id: "openCount",
			header: "Open deals",
			align: "right",
			width: "w-[13%]",
			render: (row) => String(row.openCount),
		},
		{
			id: "winRate",
			header: "Win rate",
			align: "right",
			width: "w-[13%]",
			render: (row) =>
				row.winRatePct === null ? "—" : formatPercent(row.winRatePct / 100),
		},
		{
			id: "activities",
			header: "Activities logged",
			align: "right",
			width: "w-[15%]",
			render: (row) => String(row.activitiesLogged),
		},
		...(moneyVisible
			? [
					{
						id: "wonValue",
						header: "Won value",
						align: "right" as const,
						width: "w-[24%]",
						render: (row: Row) => formatMoney(row.wonCents ?? 0, "USD"),
					},
				]
			: []),
	];

	const csvColumns = [
		{ key: "owner", label: "Owner" },
		{ key: "wonCount", label: "Deals won" },
		{ key: "openCount", label: "Open deals" },
		{ key: "winRate", label: "Win rate" },
		{ key: "activities", label: "Activities logged" },
		...(moneyVisible ? [{ key: "wonValue", label: "Won value" }] : []),
	];
	const csvRows = rows.map((row) => ({
		owner: row.name,
		wonCount: row.wonCount,
		openCount: row.openCount,
		winRate: row.winRatePct === null ? "" : formatPercent(row.winRatePct / 100),
		activities: row.activitiesLogged,
		...(moneyVisible
			? { wonValue: formatMoney(row.wonCents ?? 0, "USD") }
			: {}),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="leaderboard.csv"
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
							config={chartConfig}
							xKey="x"
							height={260}
							formatValue={(value) =>
								moneyVisible ? formatMoney(Number(value), "USD") : String(value)
							}
						/>
					</div>
					<ExcludedDisclosure excluded={data?.excluded ?? 0} />
				</>
			) : null}

			<DrillTable<Row> columns={columns} rows={rows} />
		</div>
	);
}
