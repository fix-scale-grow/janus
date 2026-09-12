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
	instanceOf?: string;
	pipelineId?: string;
}

export const DASHBOARD_LAYOUT_VERSION = 2;
const LEGACY_LAYOUT_SCALE = 4;

export const DEFAULT_LAYOUT: DashboardLayoutEntry[] = [
	{ id: "stat-won-month", x: 0, y: 0, w: 3, h: 3 },
	{ id: "stat-open-pipeline", x: 3, y: 0, w: 3, h: 3 },
	{ id: "stat-win-rate", x: 6, y: 0, w: 3, h: 3 },
	{ id: "stat-avg-deal", x: 9, y: 0, w: 3, h: 3 },
	{ id: "trend", x: 0, y: 3, w: 7, h: 10 },
	{ id: "pipeline-donut", x: 7, y: 3, w: 5, h: 10 },
	{ id: "deals-open", x: 0, y: 13, w: 6, h: 9 },
	{ id: "tasks-overdue", x: 6, y: 13, w: 6, h: 9 },
	{ id: "activity", x: 0, y: 22, w: 12, h: 8 },
];

export function upgradeLayout(
	saved: DashboardLayoutEntry[],
	version: number | undefined,
): DashboardLayoutEntry[] {
	if (version === DASHBOARD_LAYOUT_VERSION) return saved;

	return saved.map((entry) => ({
		id: entry.id,
		x: Math.round(entry.x / LEGACY_LAYOUT_SCALE),
		y: Math.round(entry.y / LEGACY_LAYOUT_SCALE),
		w: Math.round(entry.w / LEGACY_LAYOUT_SCALE),
		h: Math.round(entry.h / LEGACY_LAYOUT_SCALE),
	}));
}

export function resolveLayout(
	saved: DashboardLayoutEntry[] | undefined,
	widgets: WidgetMeta[],
	version?: number,
): DashboardLayoutEntry[] {
	if (!saved || saved.length === 0) {
		const widgetIds = new Set(widgets.map((w) => w.id));
		return DEFAULT_LAYOUT.filter((e) => widgetIds.has(e.id));
	}

	const upgraded = upgradeLayout(saved, version);
	const metaMap = new Map(widgets.map((w) => [w.id, w]));
	const filtered = upgraded.filter((e) => metaMap.has(e.id));

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
