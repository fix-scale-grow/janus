import {
	createListSearchParams,
	type SavedTableView,
} from "@/components/data-table/list-search-params";

export function dealsSearchParams(savedState?: SavedTableView) {
	return createListSearchParams(
		{
			defaultSort: "createdAt",
			defaultDir: "desc",
			tabId: "status",
			facetIds: ["owner", "stage", "closing", "pipeline"] as const,
		},
		savedState,
	);
}
