"use client";

import type { DashboardLayoutEntry } from "@crm/db/user-views";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { SummaryProvider } from "@/components/dashboard/summary-context";
import { useDashboardEdit } from "@/lib/dashboard/dashboard-edit-context";
import { resolveLayout } from "@/lib/dashboard/layout";
import { widgetsFor } from "@/lib/dashboard/widget-registry";
import { useMounted } from "@/lib/use-mounted";
import { overviewParsers } from "./overview-search-params";

export type DashboardInitial = {
	dashboardLayout?: DashboardLayoutEntry[];
	dashboardLayoutVersion?: number;
	permissionKeys: string[];
	pipelines: { id: string; name: string }[];
};

export function DashboardSummary({ initial }: { initial: DashboardInitial }) {
	const [scope] = useQueryState("scope", overviewParsers.scope);
	const mounted = useMounted();
	const edit = useDashboardEdit();

	const initialWidgets = useMemo(
		() => widgetsFor(initial.permissionKeys, initial.pipelines),
		[initial.permissionKeys, initial.pipelines],
	);
	const initialLayout = useMemo(
		() =>
			resolveLayout(
				initial.dashboardLayout,
				initialWidgets,
				initial.dashboardLayoutVersion,
			),
		[initial.dashboardLayout, initial.dashboardLayoutVersion, initialWidgets],
	);

	const layout = mounted ? edit.layout : initialLayout;
	const widgets = mounted ? edit.widgets : initialWidgets;

	return (
		<SummaryProvider scope={scope}>
			<DashboardCanvas
				layout={layout}
				widgets={widgets}
				editing={edit.editing}
				onLayoutChange={edit.setLayout}
				onRemove={edit.remove}
			/>
		</SummaryProvider>
	);
}
