"use client";

import { useQueryState } from "nuqs";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { SummaryProvider } from "@/components/dashboard/summary-context";
import { useDashboardEdit } from "@/lib/dashboard/dashboard-edit-context";
import { overviewParsers } from "./overview-search-params";

export function DashboardSummary() {
	const [scope] = useQueryState("scope", overviewParsers.scope);
	const { layout, widgets, editing, setLayout, remove } = useDashboardEdit();

	return (
		<SummaryProvider scope={scope}>
			<DashboardCanvas
				layout={layout}
				widgets={widgets}
				editing={editing}
				onLayoutChange={setLayout}
				onRemove={remove}
			/>
		</SummaryProvider>
	);
}
