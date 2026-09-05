import { createListSearchParams } from "@/components/data-table/list-search-params";

export type DrawingAttachment = "all" | "deal" | "contact" | "unattached";

export const drawingsSearchParams = createListSearchParams({
	tabId: "attachment",
});
