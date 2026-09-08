import {
	createListSearchParams,
	type SavedTableView,
} from "@/components/data-table/list-search-params";

export type InvoiceStatusFilter = "all" | "DRAFT" | "SENT" | "PAID" | "VOID";

export function invoicesSearchParams(savedState?: SavedTableView) {
	return createListSearchParams(
		{
			defaultSort: "updatedAt",
			defaultDir: "desc",
			tabId: "status",
		},
		savedState,
	);
}
