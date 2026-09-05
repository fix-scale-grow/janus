import { createListSearchParams } from "@/components/data-table/list-search-params";

export type EstimateStatusFilter =
	| "all"
	| "DRAFT"
	| "SENT"
	| "ACCEPTED"
	| "DECLINED";

export const estimatesSearchParams = createListSearchParams({
	defaultSort: "updatedAt",
	defaultDir: "desc",
	tabId: "status",
});
