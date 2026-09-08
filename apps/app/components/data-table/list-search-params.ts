import type { SortDirection } from "@crm/ui/lib/table-query";
import {
	createLoader,
	type LoaderFunction,
	type ParserBuilder,
	parseAsInteger,
	parseAsString,
	parseAsStringLiteral,
} from "nuqs/server";

const SORT_DIRECTIONS = ["asc", "desc"] as const;

type StringParser = ParserBuilder<string> & { defaultValue: string };

export type SavedTableView = {
	sort?: string;
	dir?: SortDirection;
	tab?: string;
	facets?: Record<string, string>;
	hiddenColumns?: string[];
	pageSize?: number;
};

export const searchParsers = {
	q: parseAsString.withDefault(""),
	page: parseAsInteger.withDefault(1).withOptions({ history: "push" }),
};

type ListParsers<TKey extends string> = {
	q: StringParser;
	sort: StringParser;
	dir: ParserBuilder<SortDirection> & { defaultValue: SortDirection };
	page: ParserBuilder<number> & { defaultValue: number };
} & { [K in TKey]: StringParser };

export type ListSearchValues<TKey extends string> = {
	q: string;
	sort: string;
	dir: SortDirection;
	page: number;
} & { [K in TKey]: string };

export type ListInput<TKey extends string> = {
	q: string;
	sort: string;
	dir: SortDirection;
	page: number;
	pageSize: number;
} & { [K in TKey]: string };

export type ListTableConfig<TTab extends string, TFacet extends string> = {
	defaultSort?: string;
	defaultDir?: SortDirection;
	pageSize?: number;
	tabId?: TTab;
	facetIds?: readonly TFacet[];
	facetDefaults?: Partial<Record<TFacet, string>>;
};

export type ListFactoryDefaults<_TTab extends string, TFacet extends string> = {
	sort: string;
	dir: SortDirection;
	tab?: string;
	facets: Record<TFacet, string>;
	pageSize: number;
};

export type ListSearchParams<TTab extends string, TFacet extends string> = {
	config: ListTableConfig<TTab, TFacet> & {
		defaultSort: string;
		defaultDir: SortDirection;
		pageSize: number;
	};
	factoryDefaults: ListFactoryDefaults<TTab, TFacet>;
	parsers: ListParsers<TTab | TFacet>;
	load: LoaderFunction<ListParsers<TTab | TFacet>>;
	toInput: (
		values: ListSearchValues<TTab | TFacet>,
	) => ListInput<TTab | TFacet>;
	defaultInput: () => ListInput<TTab | TFacet>;
};

export function createListSearchParams<
	TTab extends string = never,
	TFacet extends string = never,
>(
	config: ListTableConfig<TTab, TFacet> = {},
	savedState?: SavedTableView,
): ListSearchParams<TTab, TFacet> {
	const {
		defaultSort = "",
		defaultDir = "asc",
		pageSize: configPageSize = 25,
		tabId,
		facetIds = [],
		facetDefaults,
	} = config;

	const pageSize = savedState?.pageSize ?? configPageSize;
	const sortDefault = savedState?.sort ?? defaultSort;
	const dirDefault = savedState?.dir ?? defaultDir;

	const extras: Record<string, StringParser> = {};

	if (tabId) {
		extras[tabId] = parseAsString.withDefault(savedState?.tab ?? "all");
	}
	for (const id of facetIds) {
		const fallback = facetDefaults?.[id] ?? "all";
		extras[id] = parseAsString.withDefault(
			savedState?.facets?.[id] ?? fallback,
		);
	}

	const parsers = {
		...searchParsers,
		sort: parseAsString.withDefault(sortDefault),
		dir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault(dirDefault),
		...extras,
	} as ListParsers<TTab | TFacet>;

	const keys = [...(tabId ? [tabId] : []), ...facetIds] as (TTab | TFacet)[];

	const defaults = Object.fromEntries(
		Object.entries(parsers).map(([key, parser]) => [key, parser.defaultValue]),
	) as ListSearchValues<TTab | TFacet>;

	const toInput = (values: ListSearchValues<TTab | TFacet>) => {
		const selected: Record<string, string> = {};
		for (const key of keys) {
			selected[key] = values[key] ?? "all";
		}

		return {
			q: values.q.trim(),
			sort: values.sort,
			dir: values.dir,
			page: values.page > 0 ? values.page : 1,
			pageSize,
			...selected,
		} as ListInput<TTab | TFacet>;
	};

	const factoryDefaults: ListFactoryDefaults<TTab, TFacet> = {
		sort: defaultSort,
		dir: defaultDir,
		tab: tabId ? "all" : undefined,
		facets: Object.fromEntries(
			facetIds.map((id) => [id, facetDefaults?.[id] ?? "all"]),
		) as Record<TFacet, string>,
		pageSize: configPageSize,
	};

	return {
		config: {
			...config,
			defaultSort: sortDefault,
			defaultDir: dirDefault,
			pageSize,
		},
		factoryDefaults,
		parsers,
		load: createLoader(parsers),
		toInput,
		defaultInput: () => toInput(defaults),
	};
}
