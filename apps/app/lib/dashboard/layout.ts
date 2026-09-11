import type { DashboardLayoutEntry } from "@crm/db/user-views";
import { DASHBOARD } from "./dashboard-config";

export interface WidgetMeta {
	id: string;
	title: string;
	description?: string;
	minW: number;
	minH: number;
	defaultW: number;
	defaultH: number;
	permission?: "profit.view";
}

export const DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
	{ id: "stat-won-month", x: 0, y: 0, w: 12, h: 13 },
	{ id: "stat-open-pipeline", x: 12, y: 0, w: 12, h: 13 },
	{ id: "stat-win-rate", x: 24, y: 0, w: 12, h: 13 },
	{ id: "stat-avg-deal", x: 36, y: 0, w: 12, h: 13 },
	{ id: "trend", x: 0, y: 13, w: 28, h: 40 },
	{ id: "pipeline-donut", x: 28, y: 13, w: 20, h: 40 },
	{ id: "deals-open", x: 0, y: 53, w: 24, h: 36 },
	{ id: "tasks-overdue", x: 24, y: 53, w: 24, h: 36 },
	{ id: "activity", x: 0, y: 89, w: 48, h: 32 },
];

export function resolveLayout(
	saved: DashboardLayoutEntry[] | undefined,
	widgets: WidgetMeta[],
): DashboardLayoutEntry[] {
	if (!saved || saved.length === 0) {
		const widgetIds = new Set(widgets.map((w) => w.id));
		return DEFAULT_LAYOUT.filter((e) => widgetIds.has(e.id));
	}

	const metaMap = new Map(widgets.map((w) => [w.id, w]));
	const filtered = saved.filter((e) => metaMap.has(e.id));

	if (filtered.length === 0) {
		const widgetIds = new Set(widgets.map((w) => w.id));
		return DEFAULT_LAYOUT.filter((e) => widgetIds.has(e.id));
	}

	return filtered.map((entry) => {
		const meta = metaMap.get(entry.id);
		if (!meta) throw new Error(`Unknown dashboard widget: ${entry.id}`);
		const w = Math.min(Math.max(entry.w, meta.minW), DASHBOARD.grid.cols);
		const h = Math.max(entry.h, meta.minH);
		const x = Math.min(entry.x, DASHBOARD.grid.cols - w);

		return {
			id: entry.id,
			x,
			y: entry.y,
			w,
			h,
		};
	});
}

export function addEntry(
	layout: DashboardLayoutEntry[],
	meta: WidgetMeta,
): DashboardLayoutEntry[] {
	const maxY =
		layout.length === 0 ? 0 : Math.max(...layout.map((e) => e.y + e.h));

	return [
		...layout,
		{
			id: meta.id,
			x: 0,
			y: maxY,
			w: meta.defaultW,
			h: meta.defaultH,
		},
	];
}
