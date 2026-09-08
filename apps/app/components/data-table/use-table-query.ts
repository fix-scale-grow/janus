"use client";

import type { TableQueryState } from "@crm/ui/lib/table-query";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";
import type {
	ListFactoryDefaults,
	ListInput,
	ListSearchParams,
	ListSearchValues,
} from "./list-search-params";

export type TableQuery<TTab extends string, TFacet extends string> = {
	query: TableQueryState;
	input: ListInput<TTab | TFacet>;
	factoryDefaults: ListFactoryDefaults<TTab, TFacet>;
};

export function useTableQuery<TTab extends string, TFacet extends string>(
	searchParams: ListSearchParams<TTab, TFacet>,
): TableQuery<TTab, TFacet> {
	const { parsers, config, toInput, factoryDefaults } = searchParams;
	const { defaultDir, pageSize, tabId, facetIds, facetDefaults } = config;

	const [state, setState] = useQueryStates(parsers);
	const values = state as ListSearchValues<TTab | TFacet>;

	const page = values.page > 0 ? values.page : 1;
	const tab = tabId ? values[tabId] : "all";

	const filters = useMemo(() => {
		const result: Record<string, string> = {};
		if (tabId) result[tabId] = tab;
		for (const id of facetIds ?? []) {
			result[id] = values[id] ?? facetDefaults?.[id] ?? "all";
		}
		return result;
	}, [tabId, tab, facetIds, facetDefaults, values]);

	const query: TableQueryState = {
		sort: values.sort,
		dir: values.dir,
		page,
		pageSize,
		tab,
		tabId,
		filters,
		toggleSort: (id) =>
			setState((prev) =>
				prev.sort === id
					? { ...prev, dir: prev.dir === "asc" ? "desc" : "asc", page: 1 }
					: { ...prev, sort: id, dir: defaultDir, page: 1 },
			),
		setSort: (id) => setState((prev) => ({ ...prev, sort: id, page: 1 })),
		setDir: (dir) => setState((prev) => ({ ...prev, dir, page: 1 })),
		setPage: (next) => setState((prev) => ({ ...prev, page: next })),
		setTab: (value) => {
			if (!tabId) return;
			setState((prev) => ({ ...prev, [tabId]: value, page: 1 }));
		},
		setFilter: (id, value) =>
			setState((prev) => ({ ...prev, [id]: value, page: 1 })),
		clearSticky: () => {
			const cleared: Record<string, null> = { sort: null, dir: null };
			if (tabId) cleared[tabId] = null;
			for (const id of facetIds ?? []) cleared[id] = null;
			void setState(cleared as unknown as Parameters<typeof setState>[0]);
		},
	};

	return { query, input: toInput(values), factoryDefaults };
}
