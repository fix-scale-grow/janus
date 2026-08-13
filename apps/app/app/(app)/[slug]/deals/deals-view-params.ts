import { parseAsStringLiteral } from "nuqs";

/** Sales pipeline view modes: the classic table or the ported kanban board. */
export const DEAL_VIEWS = ["table", "board"] as const;

export type DealView = (typeof DEAL_VIEWS)[number];

/**
 * Client-only view toggle. Deliberately kept OUT of `dealsSearchParams` (the
 * server list loader) so switching table <-> board never re-shapes the
 * `deals.list` query input or invalidates the server prefetch.
 */
export const dealViewParser =
	parseAsStringLiteral(DEAL_VIEWS).withDefault("table");
