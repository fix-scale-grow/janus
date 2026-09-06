import { createListSearchParams } from "@/components/data-table/list-search-params";

export type ProjectStatusFilter = "all" | "ACTIVE" | "ON_HOLD" | "COMPLETE";

const PROJECT_STATUS_VALUES = ["ACTIVE", "ON_HOLD", "COMPLETE"] as const;

export function normalizeProjectStatus(value: string): ProjectStatusFilter {
	return (PROJECT_STATUS_VALUES as readonly string[]).includes(value)
		? (value as ProjectStatusFilter)
		: "all";
}

export const projectsSearchParams = createListSearchParams({
	defaultSort: "updatedAt",
	defaultDir: "desc",
	tabId: "status",
});
