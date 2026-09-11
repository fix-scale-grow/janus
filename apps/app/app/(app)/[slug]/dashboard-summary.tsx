"use client";

import { DashboardGrid, DashboardRow } from "@crm/ui/components/dashboard";
import { useQueryState } from "nuqs";
import type { ComponentType } from "react";
import { SummaryProvider } from "@/components/dashboard/summary-context";
import { DASHBOARD_WIDGETS } from "@/lib/dashboard/widget-registry";
import { overviewParsers } from "./overview-search-params";

const WIDGET_BY_ID = new Map<string, ComponentType>(
	DASHBOARD_WIDGETS.map((widget) => [widget.id, widget.component]),
);

function Widget({ id }: { id: string }) {
	const Component = WIDGET_BY_ID.get(id);
	if (!Component) return null;
	return <Component />;
}

export function DashboardSummary() {
	const [scope] = useQueryState("scope", overviewParsers.scope);

	return (
		<SummaryProvider scope={scope}>
			<div className="flex flex-col gap-6">
				<DashboardGrid columns={4}>
					<Widget id="stat-won-month" />
					<Widget id="stat-open-pipeline" />
					<Widget id="stat-win-rate" />
					<Widget id="stat-avg-deal" />
				</DashboardGrid>

				<DashboardRow split="hero">
					<Widget id="trend" />
					<Widget id="pipeline-donut" />
				</DashboardRow>

				<DashboardRow split="even">
					<Widget id="deals-open" />
					<Widget id="tasks-overdue" />
				</DashboardRow>

				<Widget id="activity" />
			</div>
		</SummaryProvider>
	);
}
