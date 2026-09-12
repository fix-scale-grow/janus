"use client";

import { CardPanelEmpty } from "@crm/ui/components/card";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Spinner } from "@crm/ui/components/spinner";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import { formatMoneyCompact } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type PipelineBoardStage =
	RouterOutputs["dashboard"]["pipelineBoard"]["stages"][number];

export function PipelineBoardWidget({
	pipelineId,
	title,
}: {
	pipelineId: string;
	title: string;
}) {
	const trpc = useTRPC();
	const query = useQuery(
		trpc.dashboard.pipelineBoard.queryOptions({ pipelineId }),
	);

	return (
		<WidgetShell title={title} description="Top deals per stage">
			{query.data ? (
				<PipelineBoardBody stages={query.data.stages} pipelineId={pipelineId} />
			) : query.isError ? (
				<WidgetError onRetry={() => query.refetch()} />
			) : (
				<div className="flex flex-1 items-center justify-center py-12">
					<Spinner />
				</div>
			)}
		</WidgetShell>
	);
}

function PipelineBoardBody({
	stages,
	pipelineId,
}: {
	stages: PipelineBoardStage[];
	pipelineId: string;
}) {
	if (stages.length === 0) {
		return <CardPanelEmpty>No open stages on this pipeline.</CardPanelEmpty>;
	}

	return (
		<div className="flex flex-1 gap-3 overflow-x-auto p-4 md:px-6">
			{stages.map((stage) => (
				<PipelineBoardColumn
					key={stage.id}
					stage={stage}
					pipelineId={pipelineId}
				/>
			))}
		</div>
	);
}

function PipelineBoardColumn({
	stage,
	pipelineId,
}: {
	stage: PipelineBoardStage;
	pipelineId: string;
}) {
	const workspaceUrl = useWorkspaceUrl();
	const overflow = stage.count - stage.topDeals.length;

	return (
		<div className="flex w-44 shrink-0 flex-col gap-2">
			<Link
				href={`${workspaceUrl("/deals")}?pipeline=${pipelineId}&stage=${stage.id}`}
				className="flex items-baseline justify-between gap-2 border-b-2 pb-1.5 hover:underline"
				style={{ borderColor: stage.color }}
			>
				<span className="truncate font-medium">{stage.label}</span>
				<span className="shrink-0 text-muted-foreground tabular-nums">
					{stage.count}
				</span>
			</Link>
			<div className="flex flex-col gap-1.5">
				{stage.topDeals.map((deal) => (
					<PipelineBoardDealChip key={deal.id} deal={deal} />
				))}
				{overflow > 0 ? (
					<span className="px-1 text-muted-foreground text-xs">
						+{overflow} more
					</span>
				) : null}
			</div>
		</div>
	);
}

function PipelineBoardDealChip({
	deal,
}: {
	deal: PipelineBoardStage["topDeals"][number];
}) {
	const openRecord = useOpenRecord();

	return (
		<button
			type="button"
			onClick={() => openRecord({ kind: "deal", id: deal.id })}
			className="flex min-w-0 flex-col rounded-md border bg-card px-2 py-1.5 text-left"
		>
			<span className="truncate font-medium">{deal.name}</span>
			<span className="truncate text-muted-foreground tabular-nums">
				{deal.amountCents === null ? (
					<EmptyCellValue />
				) : (
					formatMoneyCompact(deal.amountCents, deal.currency)
				)}
			</span>
		</button>
	);
}
