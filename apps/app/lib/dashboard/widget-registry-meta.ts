import type { WidgetMeta } from "./layout";

export const WIDGET_META: WidgetMeta[] = [
	{
		id: "stat-won-month",
		title: "Closed won this month",
		minW: 8,
		minH: 11,
		defaultW: 12,
		defaultH: 13,
	},
	{
		id: "stat-open-pipeline",
		title: "Open pipeline",
		minW: 8,
		minH: 11,
		defaultW: 12,
		defaultH: 13,
	},
	{
		id: "stat-win-rate",
		title: "Win rate",
		minW: 8,
		minH: 11,
		defaultW: 12,
		defaultH: 13,
	},
	{
		id: "stat-avg-deal",
		title: "Average deal",
		minW: 8,
		minH: 11,
		defaultW: 12,
		defaultH: 13,
	},
	{
		id: "trend",
		title: "Closed won vs. new pipeline",
		description: "Last six months, by the month a deal closed or was created",
		minW: 16,
		minH: 24,
		defaultW: 28,
		defaultH: 40,
	},
	{
		id: "pipeline-donut",
		title: "Open pipeline by stage",
		description: "Where the value sits right now",
		minW: 14,
		minH: 24,
		defaultW: 20,
		defaultH: 40,
	},
	{
		id: "deals-open",
		title: "Deals in progress",
		description:
			"The largest open deals, and how long each has sat in its stage",
		minW: 16,
		minH: 22,
		defaultW: 24,
		defaultH: 36,
	},
	{
		id: "tasks-overdue",
		title: "Overdue tasks",
		minW: 14,
		minH: 20,
		defaultW: 24,
		defaultH: 36,
	},
	{
		id: "activity",
		title: "Recent activity",
		minW: 16,
		minH: 20,
		defaultW: 48,
		defaultH: 32,
	},
	{
		id: "profit-by-month",
		title: "Profit by month",
		description: "Invoiced minus costs, over the last six months",
		minW: 16,
		minH: 22,
		defaultW: 24,
		defaultH: 34,
		permission: "profit.view",
	},
	{
		id: "costs-by-category",
		title: "Costs by category",
		description: "Spend over the last six months, by category",
		minW: 14,
		minH: 20,
		defaultW: 24,
		defaultH: 34,
		permission: "profit.view",
	},
	{
		id: "tasks-upcoming",
		title: "Upcoming tasks",
		description: "What's on the schedule in the next two weeks",
		minW: 14,
		minH: 20,
		defaultW: 24,
		defaultH: 30,
	},
];

export function visibleWidgets<T extends WidgetMeta>(
	widgets: T[],
	keys: string[],
): T[] {
	const granted = new Set(keys);
	return widgets.filter(
		(widget) => !widget.permission || granted.has(widget.permission),
	);
}

export const PIPELINE_BOARD_PREFIX = "pipeline-board:";

export function pipelineBoardMeta(pipeline: {
	id: string;
	name: string;
}): WidgetMeta & { instanceOf: "pipeline-board"; pipelineId: string } {
	return {
		id: `${PIPELINE_BOARD_PREFIX}${pipeline.id}`,
		title: `${pipeline.name} — mini board`,
		minW: 20,
		minH: 20,
		defaultW: 24,
		defaultH: 34,
		instanceOf: "pipeline-board",
		pipelineId: pipeline.id,
	};
}

export function isPipelineBoardId(id: string): boolean {
	return id.startsWith(PIPELINE_BOARD_PREFIX);
}
