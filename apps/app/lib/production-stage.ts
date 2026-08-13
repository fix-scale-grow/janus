import { ProductionStage } from "@crm/db/enums";

/** Left-to-right order the Production board lays its columns out in. */
const ORDER = [
	ProductionStage.SCHEDULED,
	ProductionStage.IN_PROGRESS,
	ProductionStage.ON_HOLD,
	ProductionStage.COMPLETE,
	ProductionStage.PAID,
] as const;

const LABELS: Record<ProductionStage, string> = {
	SCHEDULED: "Scheduled",
	IN_PROGRESS: "In progress",
	ON_HOLD: "On hold",
	COMPLETE: "Complete",
	PAID: "Paid",
};

/** Sentinel column id for won jobs not yet placed on the board (productionStage
 * is `null`). Kept distinct from every real `ProductionStage` value so a drop
 * back into it can be told apart from a stage move. */
export const UNSCHEDULED = "UNSCHEDULED" as const;
export type ProductionColumn = ProductionStage | typeof UNSCHEDULED;

export const PRODUCTION_STAGE_OPTIONS = ORDER.map((value) => ({
	value,
	label: LABELS[value],
}));

const COLUMN_COLORS: Record<ProductionColumn, string> = {
	UNSCHEDULED: "var(--muted-foreground)",
	SCHEDULED: "var(--chart-1)",
	IN_PROGRESS: "var(--chart-2)",
	ON_HOLD: "var(--chart-4)",
	COMPLETE: "var(--chart-3)",
	PAID: "var(--chart-5)",
};

export function productionStageColor(column: ProductionColumn): string {
	return COLUMN_COLORS[column] ?? "var(--chart-5)";
}

export function productionStageLabel(stage: ProductionStage): string {
	return LABELS[stage];
}

/** Won jobs only — production is strictly post-win work. Fixed, high page size:
 * a single crew's active job list is small and the board wants them all at once
 * rather than paginated. Shared by the server prefetch and the client board so
 * both hit the exact same `deals.list` cache key. */
export const WON_JOBS_INPUT = {
	q: "",
	sort: "",
	dir: "asc",
	page: 1,
	pageSize: 100,
	status: "all",
	owner: "all",
	stage: "CLOSED_WON",
	closing: "all",
} as const;

/** Real stages plus the Unscheduled intake column, in board order. */
export const PRODUCTION_COLUMNS: {
	id: ProductionColumn;
	label: string;
}[] = [
	{ id: UNSCHEDULED, label: "Unscheduled" },
	...PRODUCTION_STAGE_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
];
