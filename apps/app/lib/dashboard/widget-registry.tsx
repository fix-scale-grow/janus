"use client";

import { useQuery } from "@tanstack/react-query";
import { type ComponentType, useMemo } from "react";
import { ActivityWidget } from "@/components/dashboard/widgets/activity-widget";
import { AskJanusWidget } from "@/components/dashboard/widgets/ask-janus-widget";
import { DealsOpenWidget } from "@/components/dashboard/widgets/deals-open-widget";
import { PipelineBoardWidget } from "@/components/dashboard/widgets/pipeline-board-widget";
import { PipelineDonutWidget } from "@/components/dashboard/widgets/pipeline-donut-widget";
import {
	CostsByCategoryWidget,
	ProfitByMonthWidget,
} from "@/components/dashboard/widgets/profit-widgets";
import {
	StatAvgDealWidget,
	StatOpenPipelineWidget,
	StatWinRateWidget,
	StatWonMonthWidget,
} from "@/components/dashboard/widgets/stat-widgets";
import { TasksOverdueWidget } from "@/components/dashboard/widgets/tasks-overdue-widget";
import { TasksUpcomingWidget } from "@/components/dashboard/widgets/tasks-upcoming-widget";
import { TrendWidget } from "@/components/dashboard/widgets/trend-widget";
import { useTRPC } from "@/lib/trpc/client";
import type { WidgetMeta } from "./layout";
import {
	pipelineBoardMeta,
	visibleWidgets,
	WIDGET_META,
} from "./widget-registry-meta";

const WIDGET_COMPONENTS: Record<string, ComponentType> = {
	"stat-won-month": StatWonMonthWidget,
	"stat-open-pipeline": StatOpenPipelineWidget,
	"stat-win-rate": StatWinRateWidget,
	"stat-avg-deal": StatAvgDealWidget,
	trend: TrendWidget,
	"pipeline-donut": PipelineDonutWidget,
	"deals-open": DealsOpenWidget,
	"tasks-overdue": TasksOverdueWidget,
	activity: ActivityWidget,
	"profit-by-month": ProfitByMonthWidget,
	"costs-by-category": CostsByCategoryWidget,
	"tasks-upcoming": TasksUpcomingWidget,
	"ask-janus": AskJanusWidget,
};

export const DASHBOARD_WIDGETS: (WidgetMeta & { component: ComponentType })[] =
	WIDGET_META.map((meta) => {
		const component = WIDGET_COMPONENTS[meta.id];
		if (!component) {
			throw new Error(`No component registered for widget "${meta.id}"`);
		}
		return { ...meta, component };
	});

export { visibleWidgets };

const boardComponentCache = new Map<string, ComponentType>();

function boardComponentFor(pipelineId: string, title: string): ComponentType {
	const cached = boardComponentCache.get(pipelineId);
	if (cached) return cached;
	const component: ComponentType = () => (
		<PipelineBoardWidget pipelineId={pipelineId} title={title} />
	);
	boardComponentCache.set(pipelineId, component);
	return component;
}

export function useVisibleWidgets(): (WidgetMeta & {
	component: ComponentType;
})[] {
	const trpc = useTRPC();
	const permissions = useQuery(trpc.permissions.mine.queryOptions());
	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: false }),
	);
	const keys = permissions.data?.keys ?? [];
	const boardWidgets = useMemo(
		() =>
			(pipelines.data ?? []).map((pipeline) => {
				const meta = pipelineBoardMeta(pipeline);
				return {
					...meta,
					component: boardComponentFor(meta.pipelineId, meta.title),
				};
			}),
		[pipelines.data],
	);
	return [
		...visibleWidgets(DASHBOARD_WIDGETS, keys),
		...visibleWidgets(boardWidgets, keys),
	];
}
