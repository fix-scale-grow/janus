import {
	createListSearchParams,
	type SavedTableView,
} from "@/components/data-table/list-search-params";

export type EstimateStatusFilter =
	| "all"
	| "DRAFT"
	| "SENT"
	| "ACCEPTED"
	| "DECLINED";

export function estimatesSearchParams(savedState?: SavedTableView) {
	return createListSearchParams(
		{
			defaultSort: "updatedAt",
			defaultDir: "desc",
			tabId: "status",
		},
		savedState,
	);
}
