import { parseAsStringLiteral } from "nuqs/server";
import { createListSearchParams } from "@/components/data-table/list-search-params";

export const PROJECTS_VIEWS = ["table", "calendar"] as const;

export type ProjectsView = (typeof PROJECTS_VIEWS)[number];

export const projectsViewParser =
	parseAsStringLiteral(PROJECTS_VIEWS).withDefault("table");

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
