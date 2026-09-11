"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { SummaryProvider } from "@/components/dashboard/summary-context";
import { resolveLayout } from "@/lib/dashboard/layout";
import { useVisibleWidgets } from "@/lib/dashboard/widget-registry";
import { useTRPC } from "@/lib/trpc/client";
import { overviewParsers } from "./overview-search-params";

export function DashboardSummary() {
	const [scope] = useQueryState("scope", overviewParsers.scope);
	const trpc = useTRPC();
	const view = useQuery(trpc.views.get.queryOptions({ tableId: "dashboard" }));
	const visible = useVisibleWidgets();
	const layout = resolveLayout(view.data?.dashboardLayout, visible);

	return (
		<SummaryProvider scope={scope}>
			<DashboardCanvas
				layout={layout}
				widgets={visible}
				editing={false}
				onLayoutChange={() => {}}
			/>
		</SummaryProvider>
	);
}
