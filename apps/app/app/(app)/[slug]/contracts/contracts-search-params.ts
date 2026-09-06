import { createListSearchParams } from "@/components/data-table/list-search-params";

export type ContractStatusFilter = "all" | "DRAFT" | "SENT" | "SIGNED" | "VOID";

export const contractsSearchParams = createListSearchParams({
	defaultSort: "updatedAt",
	defaultDir: "desc",
	tabId: "status",
});
