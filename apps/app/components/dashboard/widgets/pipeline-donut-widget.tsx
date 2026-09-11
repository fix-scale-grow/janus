"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { WidgetShell } from "@crm/ui/components/widget-shell";
import { formatMoney, formatMoneyCompact } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { DonutStat } from "@/components/dashboard-charts";
import {
	type Summary,
	SummarySpinnerRow,
	useSummary,
	WidgetBoundary,
} from "@/components/dashboard/summary-context";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type PipelineStages = Summary["pipeline"];

export function stageHref(
	workspaceUrl: (path?: string) => string,
	slice: { key: string },
	pipelineId: string | null,
): string {
	return `${workspaceUrl("/deals")}?stage=${slice.key}${
		pipelineId ? `&pipeline=${pipelineId}` : ""
	}`;
}

export function PipelineDonutWidget() {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const { summary, scope, refetchSummary } = useSummary();

	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: false }),
	);

	const [selectedPipelineId, setSelectedPipelineId] = useState<
		string | undefined
	>(summary?.pipeline.pipelineId ?? undefined);

	const chartQuery = useQuery({
		...trpc.dashboard.pipelineStages.queryOptions({
			scope,
			pipelineId: selectedPipelineId,
		}),
		enabled: Boolean(summary) && selectedPipelineId !== summary?.pipeline.pipelineId,
		placeholderData: (previous) => previous,
	});

	if (!summary) {
		return (
			<WidgetShell
				title="Open pipeline by stage"
				description="Where the value sits right now"
			>
				<WidgetBoundary onRetry={refetchSummary}>
					<SummarySpinnerRow />
				</WidgetBoundary>
			</WidgetShell>
		);
	}

	const { pipeline, reportingCurrency } = summary;
	const chartPipeline: PipelineStages =
		selectedPipelineId === pipeline.pipelineId
			? pipeline
			: (chartQuery.data ?? pipeline);

	const money = (cents: number) => formatMoneyCompact(cents, reportingCurrency);
	const exact = (value: unknown) =>
		formatMoney(
			typeof value === "number" ? value : Number(value),
			reportingCurrency,
		);

	const stageSlices = chartPipeline.stages.flatMap((stage) =>
		stage.valueCents > 0
			? [
					{
						key: stage.id,
						label: stage.label,
						value: stage.valueCents,
						color: stage.color,
						count: stage.count,
					},
				]
			: [],
	);

	return (
		<WidgetShell
			title="Open pipeline by stage"
			description="Where the value sits right now"
			action={
				pipelines.data && pipelines.data.length > 1 ? (
					<Select
						value={chartPipeline.pipelineId ?? undefined}
						onValueChange={setSelectedPipelineId}
					>
						<SelectTrigger className="w-40" size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pipelines.data.map((option) => (
								<SelectItem key={option.id} value={option.id}>
									{option.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null
			}
		>
			<WidgetBoundary onRetry={refetchSummary}>
				{stageSlices.length > 0 ? (
					<div className="flex flex-1 flex-col justify-between gap-1 pt-4">
						<DonutStat
							data={stageSlices}
							height={168}
							centerValue={money(chartPipeline.totalCents)}
							centerLabel="open"
							formatValue={exact}
						/>
						<ul className="flex flex-col px-5 pb-1 md:px-6">
							{stageSlices.map((slice) => (
								<li key={slice.key} className="border-t first:border-t-0">
									<Link
										href={stageHref(
											workspaceUrl,
											slice,
											chartPipeline.pipelineId,
										)}
										className="flex items-center gap-2.5 py-2 text-xs hover:underline"
									>
										<span
											aria-hidden
											className="size-1.5 shrink-0"
											style={{ backgroundColor: slice.color }}
										/>
										<span className="min-w-0 flex-1 truncate">
											{slice.label}
										</span>
										<span className="shrink-0 text-muted-foreground tabular-nums">
											{slice.count}
										</span>
										<span className="w-14 shrink-0 text-right font-medium tabular-nums">
											{money(slice.value)}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center px-5 py-10 text-muted-foreground text-sm md:px-6">
						Nothing open
					</div>
				)}
			</WidgetBoundary>
		</WidgetShell>
	);
}
