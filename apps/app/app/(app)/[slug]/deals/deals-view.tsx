"use client";

import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useQueryState } from "nuqs";
import { DealsBoard } from "./deals-board";
import { DealsTable } from "./deals-table";
import { DEAL_VIEWS, type DealView, dealViewParser } from "./deals-view-params";

const LABELS: Record<DealView, string> = {
	table: "Table",
	board: "Board",
};

function isView(value: string): value is DealView {
	return (DEAL_VIEWS as readonly string[]).includes(value);
}

/** Header control that flips the deals page between the table and the board. */
export function DealsViewSwitch() {
	const [view, setView] = useQueryState("view", dealViewParser);

	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			spacing={0}
			value={view}
			onValueChange={(next) => {
				if (isView(next)) void setView(next);
			}}
			aria-label="Deals view"
		>
			{DEAL_VIEWS.map((value) => (
				<ToggleGroupItem key={value} value={value}>
					{LABELS[value]}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

/** Renders the active deals view. Both views read the same `deals.list` cache. */
export function DealsView() {
	const [view] = useQueryState("view", dealViewParser);
	return view === "board" ? <DealsBoard /> : <DealsTable />;
}
