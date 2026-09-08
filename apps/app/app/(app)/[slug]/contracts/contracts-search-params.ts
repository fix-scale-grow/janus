import {
	createListSearchParams,
	type SavedTableView,
} from "@/components/data-table/list-search-params";

export type ContractStatusFilter = "all" | "DRAFT" | "SENT" | "SIGNED" | "VOID";

export function contractsSearchParams(savedState?: SavedTableView) {
	return createListSearchParams(
		{
			defaultSort: "updatedAt",
			defaultDir: "desc",
			tabId: "status",
		},
		savedState,
	);
}
