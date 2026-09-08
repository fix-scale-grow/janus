export type SortDirection = "asc" | "desc";

export type TableQueryState = {
	sort: string;
	dir: SortDirection;
	page: number;
	pageSize: number;
	tab: string;
	tabId?: string;
	filters: Record<string, string>;
	toggleSort: (id: string) => void;
	setSort: (id: string) => void;
	setDir: (dir: SortDirection) => void;
	setPage: (page: number) => void;
	setTab: (value: string) => void;
	setFilter: (id: string, value: string) => void;
	clearSticky: () => void;
};

export function composeStickyFacets(
	filters: Record<string, string>,
	tabId?: string,
): Record<string, string> {
	if (!tabId) return filters;
	const facets = { ...filters };
	delete facets[tabId];
	return facets;
}

export type StickySaveDecision =
	| { action: "seed"; serialized: string }
	| { action: "settle" }
	| { action: "skip" }
	| { action: "schedule"; serialized: string };

export function decideStickySave(params: {
	serialized: string;
	mounted: boolean;
	resetting: boolean;
	lastPersisted: string | null;
}): StickySaveDecision {
	const { serialized, mounted, resetting, lastPersisted } = params;

	if (!mounted) return { action: "seed", serialized };
	if (resetting) {
		return serialized === lastPersisted
			? { action: "settle" }
			: { action: "skip" };
	}
	if (serialized === lastPersisted) return { action: "skip" };

	return { action: "schedule", serialized };
}
