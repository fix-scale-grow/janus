import type { WidgetMeta } from "./layout";

export const WIDGET_META: WidgetMeta[] = [
	{
		id: "stat-won-month",
		title: "Closed won this month",
		minW: 2,
		minH: 2,
		defaultW: 3,
		defaultH: 3,
	},
	{
		id: "stat-open-pipeline",
		title: "Open pipeline",
		minW: 2,
		minH: 2,
		defaultW: 3,
		defaultH: 3,
	},
	{
		id: "stat-win-rate",
		title: "Win rate",
		minW: 2,
		minH: 2,
		defaultW: 3,
		defaultH: 3,
	},
	{
		id: "stat-avg-deal",
		title: "Average deal",
		minW: 2,
		minH: 2,
		defaultW: 3,
		defaultH: 3,
	},
	{
		id: "trend",
		title: "Closed won vs. new pipeline",
		description: "Last six months, by the month a deal closed or was created",
		minW: 4,
		minH: 6,
		defaultW: 7,
		defaultH: 10,
	},
	{
		id: "pipeline-donut",
		title: "Open pipeline by stage",
		description: "Where the value sits right now",
		minW: 4,
		minH: 6,
		defaultW: 5,
		defaultH: 10,
	},
	{
		id: "deals-open",
		title: "Deals in progress",
		description:
			"The largest open deals, and how long each has sat in its stage",
		minW: 4,
		minH: 5,
		defaultW: 6,
		defaultH: 9,
	},
	{
		id: "tasks-overdue",
		title: "Overdue tasks",
		minW: 4,
		minH: 5,
		defaultW: 6,
		defaultH: 9,
	},
	{
		id: "activity",
		title: "Recent activity",
		minW: 4,
		minH: 5,
		defaultW: 12,
		defaultH: 8,
	},
	{
		id: "profit-by-month",
		title: "Profit by month",
		description: "Invoiced minus costs, over the last six months",
		minW: 4,
		minH: 5,
		defaultW: 6,
		defaultH: 9,
		permission: "profit.view",
	},
	{
		id: "costs-by-category",
		title: "Costs by category",
		description: "Spend over the last six months, by category",
		minW: 4,
		minH: 5,
		defaultW: 6,
		defaultH: 9,
		permission: "profit.view",
	},
	{
		id: "tasks-upcoming",
		title: "Upcoming tasks",
		description: "What's on the schedule in the next two weeks",
		minW: 4,
		minH: 5,
		defaultW: 6,
		defaultH: 8,
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
		description: "Top deals per stage",
		minW: 5,
		minH: 6,
		defaultW: 6,
		defaultH: 9,
		instanceOf: "pipeline-board",
		pipelineId: pipeline.id,
	};
}

export function isPipelineBoardId(id: string): boolean {
	return id.startsWith(PIPELINE_BOARD_PREFIX);
}
