"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { formatMoney, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useState } from "react";
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

type StageRow =
	RouterOutputs["reports"]["pipeline"]["pipelines"][number]["stages"][number] & {
		id: string;
	};
type LossRow =
	RouterOutputs["reports"]["pipeline"]["pipelines"][number]["lossReasons"][number] & {
		id: string;
	};
type TierRow =
	RouterOutputs["reports"]["pipeline"]["estimatesFunnel"]["byTier"][number] & {
		id: string;
	};

const CHART_CONFIG: ChartConfig = {
	value: { label: "Deals", color: "var(--chart-1)" },
};

export function PipelineReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());
	const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
		null,
	);

	const { data } = useQuery(trpc.reports.pipeline.queryOptions({ from, to }));

	const pipelines = data?.pipelines ?? [];
	const selectedPipeline =
		pipelines.find((pipeline) => pipeline.pipelineId === selectedPipelineId) ??
		pipelines[0];

	const stageRows: StageRow[] = (selectedPipeline?.stages ?? []).map((row) => ({
		...row,
		id: row.stageId,
	}));
	const lossRows: LossRow[] = (selectedPipeline?.lossReasons ?? []).map(
		(row) => ({ ...row, id: row.reason }),
	);
	const byTier = data?.estimatesFunnel.byTier ?? [];
	const tierRows: TierRow[] = byTier.map((row) => ({ ...row, id: row.tier }));
	const tierMoneyVisible = byTier.some((row) => row.valueCents !== null);
	const hasStages = stageRows.length > 0;

	const stageColumns: DrillTableColumn<StageRow>[] = [
		{
			id: "stage",
			header: "Stage",
			width: "w-[30%]",
			render: (row) => row.stageLabel,
		},
		{
			id: "count",
			header: "Deals",
			align: "right",
			width: "w-[20%]",
			render: (row) => String(row.count),
		},
		{
			id: "conversion",
			header: "Conversion",
			align: "right",
			width: "w-[25%]",
			render: (row) =>
				row.conversionPct === null
					? "—"
					: formatPercent(row.conversionPct / 100),
		},
		{
			id: "avgDays",
			header: "Avg days in stage",
			align: "right",
			width: "w-[25%]",
			render: (row) =>
				row.avgDaysInStage === null ? "—" : `${row.avgDaysInStage.toFixed(1)}d`,
		},
	];

	const lossColumns: DrillTableColumn<LossRow>[] = [
		{
			id: "reason",
			header: "Loss reason",
			width: "w-[70%]",
			render: (row) => row.reason,
		},
		{
			id: "count",
			header: "Deals",
			align: "right",
			width: "w-[30%]",
			render: (row) => String(row.count),
		},
	];

	const tierColumns: DrillTableColumn<TierRow>[] = [
		{
			id: "tier",
			header: "Tier",
			width: tierMoneyVisible ? "w-[40%]" : "w-[60%]",
			render: (row) => row.tier,
		},
		{
			id: "count",
			header: "Accepted",
			align: "right",
			width: tierMoneyVisible ? "w-[30%]" : "w-[40%]",
			render: (row) => String(row.count),
		},
		...(tierMoneyVisible
			? [
					{
						id: "value",
						header: "Value",
						align: "right" as const,
						width: "w-[30%]",
						render: (row: TierRow) => formatMoney(row.valueCents ?? 0, "USD"),
					},
				]
			: []),
	];

	const csvColumns = [
		{ key: "stage", label: "Stage" },
		{ key: "count", label: "Deals" },
		{ key: "conversion", label: "Conversion" },
		{ key: "avgDays", label: "Avg days in stage" },
	];
	const csvRows = stageRows.map((row) => ({
		stage: row.stageLabel,
		count: row.count,
		conversion:
			row.conversionPct === null ? "" : formatPercent(row.conversionPct / 100),
		avgDays: row.avgDaysInStage === null ? "" : row.avgDaysInStage.toFixed(1),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="pipeline.csv"
				/>
			</div>

			{pipelines.length > 0 ? (
				<Select
					value={selectedPipeline?.pipelineId}
					onValueChange={(value) => setSelectedPipelineId(value)}
				>
					<SelectTrigger className="w-64">
						<SelectValue placeholder="Choose a pipeline" />
					</SelectTrigger>
					<SelectContent>
						{pipelines.map((pipeline) => (
							<SelectItem key={pipeline.pipelineId} value={pipeline.pipelineId}>
								{pipeline.pipelineName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : null}

			{hasStages ? (
				<div className="rounded-lg border">
					<BarTrend
						data={stageRows.map((row) => ({
							x: row.stageLabel,
							value: row.count,
						}))}
						config={CHART_CONFIG}
						xKey="x"
						height={240}
						barLabel={(datum) => {
							const row = stageRows.find(
								(stage) => stage.stageLabel === datum.x,
							);
							if (!row || row.conversionPct === null) return null;
							return formatPercent(row.conversionPct / 100);
						}}
					/>
				</div>
			) : null}

			<DrillTable<StageRow> columns={stageColumns} rows={stageRows} />
			<DrillTable<LossRow>
				columns={lossColumns}
				rows={lossRows}
				emptyTitle="No losses in this range"
			/>

			<div className="flex flex-col gap-3">
				<h2 className="font-heading font-medium text-sm">Estimates funnel</h2>
				<KpiRow kpis={data?.kpis ?? []} />
				<DrillTable<TierRow>
					columns={tierColumns}
					rows={tierRows}
					emptyTitle="No accepted estimates in this range"
				/>
				<ExcludedDisclosure excluded={data?.excluded ?? 0} />
			</div>
		</div>
	);
}
