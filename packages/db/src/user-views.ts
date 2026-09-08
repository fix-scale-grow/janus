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
] as const;

export type ViewTableId = (typeof VIEW_TABLE_IDS)[number];

export const viewTableId = z.enum(VIEW_TABLE_IDS);

export const viewStateSchema = z
	.object({
		sort: z.string().optional(),
		dir: z.enum(["asc", "desc"]).optional(),
		tab: z.string().optional(),
		facets: z.record(z.string(), z.string()).optional(),
		hiddenColumns: z.array(z.string()).optional(),
		pageSize: z.number().int().positive().optional(),
		density: z.enum(["comfortable", "compact"]).optional(),
	})
	.strip();

export type ViewState = z.infer<typeof viewStateSchema>;

export const VIEW_STATE_MAX_BYTES = 4096;

export function parseViewState(value: unknown): ViewState {
	return viewStateSchema.parse(value);
}
