import {
	createListSearchParams,
	type SavedTableView,
} from "@/components/data-table/list-search-params";

export function contactsSearchParams(savedState?: SavedTableView) {
	return createListSearchParams(
		{
			defaultSort: "createdAt",
			defaultDir: "desc",
			facetIds: ["owner"] as const,
		},
		savedState,
	);
}
