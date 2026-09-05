import { createListSearchParams } from "@/components/data-table/list-search-params";

export type ProjectStatusFilter = "all" | "ACTIVE" | "ON_HOLD" | "COMPLETE";

export const projectsSearchParams = createListSearchParams({
	defaultSort: "updatedAt",
	defaultDir: "desc",
	tabId: "status",
});
