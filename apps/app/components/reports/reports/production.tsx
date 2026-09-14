"use client";

import type { ProductionStage } from "@crm/db/enums";
import type { ChartConfig } from "@crm/ui/components/chart";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { BarTrend, DonutStat } from "@/components/dashboard-charts";
import {
	DrillTable,
	type DrillTableColumn,
} from "@/components/reports/drill-table";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { KpiRow } from "@/components/reports/kpi-row";
import { RangeControl } from "@/components/reports/range-control";
import {
	productionStageColor,
	productionStageLabel,
} from "@/lib/production-stage";
import { effectiveRange, reportRangeParsers } from "@/lib/reports/range";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type CrewRow = RouterOutputs["reports"]["production"]["crews"][number] & {
	id: string;
};

const CHART_CONFIG: ChartConfig = {
	count: { label: "Jobs completed", color: "var(--chart-1)" },
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

function stageLabel(stage: string): string {
	return productionStageLabel(stage as ProductionStage);
}

export function ProductionReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(trpc.reports.production.queryOptions({ from, to }));

	const stageCounts = data?.stageCounts ?? [];
	const throughput = data?.throughputByMonth ?? [];
	const crewRows: CrewRow[] = (data?.crews ?? []).map((row) => ({
		...row,
		id: row.crewId,
	}));
	const hasStageData = stageCounts.length > 0;
	const totalInProduction = stageCounts.reduce(
		(sum, row) => sum + row.count,
		0,
	);

	const kpis = (data?.kpis ?? []).map((kpi) =>
		kpi.key === "avgScheduledToComplete" &&
		data?.avgScheduledToCompleteDays === null
			? { ...kpi, value: "Not enough history yet" }
			: kpi,
	);

	const crewColumns: DrillTableColumn<CrewRow>[] = [
		{
			id: "crew",
			header: "Crew",
			width: "w-[30%]",
			render: (row) => (
				<span className="flex items-center gap-2">
					<span
						className={`size-2 shrink-0 rounded-full ${
							(CREW_COLOR_CLASSES[row.color] ?? NO_CREW_CLASSES).dot
						}`}
					/>
					{row.name}
				</span>
			),
		},
		{
			id: "taskCount",
			header: "Tasks",
			align: "right",
			width: "w-[15%]",
			render: (row) => String(row.taskCount),
		},
		{
			id: "taskDays",
			header: "Task days",
			align: "right",
			width: "w-[15%]",
			render: (row) => String(row.taskDays),
		},
		{
			id: "done",
			header: "Done",
			align: "right",
			width: "w-[20%]",
			render: (row) => String(row.doneCount),
		},
		{
			id: "open",
			header: "Open",
			align: "right",
			width: "w-[20%]",
			render: (row) => String(row.openCount),
		},
	];

	const csvColumns = [
		{ key: "crew", label: "Crew" },
		{ key: "taskCount", label: "Tasks" },
		{ key: "taskDays", label: "Task days" },
		{ key: "done", label: "Done" },
		{ key: "open", label: "Open" },
	];
	const csvRows = crewRows.map((row) => ({
		crew: row.name,
		taskCount: row.taskCount,
		taskDays: row.taskDays,
		done: row.doneCount,
		open: row.openCount,
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="production.csv"
				/>
			</div>

			<KpiRow kpis={kpis} />

			{hasStageData ? (
				<div className="rounded-lg border p-4">
					<DonutStat
						data={stageCounts.map((row) => ({
							key: row.stage,
							label: stageLabel(row.stage),
							value: row.count,
							color: productionStageColor(row.stage as ProductionStage),
						}))}
						height={220}
						centerValue={String(totalInProduction)}
						centerLabel="In production"
					/>
				</div>
			) : null}

			<div className="rounded-lg border">
				<BarTrend
					data={throughput.map((point) => ({
						x: point.month,
						count: point.count,
					}))}
					config={CHART_CONFIG}
					xKey="x"
					height={220}
					formatX={formatMonthLabel}
				/>
			</div>

			<DrillTable<CrewRow>
				columns={crewColumns}
				rows={crewRows}
				emptyTitle="No crews yet"
			/>
		</div>
	);
}
