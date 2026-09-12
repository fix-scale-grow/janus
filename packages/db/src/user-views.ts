import { z } from "zod";

export const VIEW_TABLE_IDS = [
	"deals",
	"contacts",
	"projects",
	"estimates",
	"invoices",
	"contracts",
	"deals-board",
	"production-board",
	"project-board",
	"nav",
	"dashboard",
] as const;

export type ViewTableId = (typeof VIEW_TABLE_IDS)[number];

export const viewTableId = z.enum(VIEW_TABLE_IDS);

export const DASHBOARD_LAYOUT_MAX = { y: 500, h: 120 } as const;

export const dashboardLayoutEntry = z.object({
	id: z.string().max(64),
	x: z.number().int().min(0).max(47),
	y: z.number().int().min(0).max(DASHBOARD_LAYOUT_MAX.y),
	w: z.number().int().min(1).max(48),
	h: z.number().int().min(1).max(DASHBOARD_LAYOUT_MAX.h),
});

export type DashboardLayoutEntry = z.infer<typeof dashboardLayoutEntry>;

export const viewStateSchema = z
	.object({
		sort: z.string().optional(),
		dir: z.enum(["asc", "desc"]).optional(),
		tab: z.string().optional(),
		facets: z.record(z.string(), z.string()).optional(),
		hiddenColumns: z.array(z.string()).optional(),
		pageSize: z.number().int().positive().optional(),
		density: z.enum(["comfortable", "compact"]).optional(),
		navOrder: z.array(z.string().max(100)).max(40).optional(),
		navHidden: z.array(z.string().max(120)).max(60).optional(),
		dashboardLayout: z.array(dashboardLayoutEntry).max(20).optional(),
		dashboardLayoutVersion: z.number().int().optional(),
	})
	.strip();

export type ViewState = z.infer<typeof viewStateSchema>;

export const VIEW_STATE_MAX_BYTES = 4096;

export function parseViewState(value: unknown): ViewState {
	return viewStateSchema.parse(value);
}
