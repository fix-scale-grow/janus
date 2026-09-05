import { createListSearchParams } from "@/components/data-table/list-search-params";

export type InvoiceStatusFilter = "all" | "DRAFT" | "SENT" | "PAID" | "VOID";

export const invoicesSearchParams = createListSearchParams({
	defaultSort: "updatedAt",
	defaultDir: "desc",
	tabId: "status",
});
