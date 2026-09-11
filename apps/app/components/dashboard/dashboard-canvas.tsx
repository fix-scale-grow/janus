"use client";

import type { DashboardLayoutEntry } from "@crm/db/user-views";
import type { ComponentType } from "react";
import {
	GridLayout,
	type Layout,
	useContainerWidth,
	verticalCompactor,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { DASHBOARD } from "@/lib/dashboard/dashboard-config";
import type { WidgetMeta } from "@/lib/dashboard/layout";

type DashboardWidget = WidgetMeta & { component: ComponentType };

function sortByPosition(
	layout: DashboardLayoutEntry[],
): DashboardLayoutEntry[] {
	return [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
}

function WidgetStack({
	layout,
	widgetsById,
}: {
	layout: DashboardLayoutEntry[];
	widgetsById: Map<string, DashboardWidget>;
}) {
	return (
		<div className="flex flex-col gap-4">
			{sortByPosition(layout).map((entry) => {
				const widget = widgetsById.get(entry.id);
				if (!widget) return null;
				const Component = widget.component;
				return <Component key={entry.id} />;
			})}
		</div>
	);
}

export function DashboardCanvas({
	layout,
	widgets,
	editing,
	onLayoutChange,
}: {
	layout: DashboardLayoutEntry[];
	widgets: DashboardWidget[];
	editing: boolean;
	onLayoutChange: (layout: DashboardLayoutEntry[]) => void;
}) {
	const { width, containerRef, mounted } = useContainerWidth();
	const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));

	const rglLayout: Layout = layout
		.filter((entry) => widgetsById.has(entry.id))
		.map((entry) => {
			const widget = widgetsById.get(entry.id);
			return {
				i: entry.id,
				x: entry.x,
				y: entry.y,
				w: entry.w,
				h: entry.h,
				minW: widget?.minW,
				minH: widget?.minH,
			};
		});

	function handleLayoutChange(next: Layout) {
		onLayoutChange(
			next.map((item) => ({
				id: item.i,
				x: item.x,
				y: item.y,
				w: item.w,
				h: item.h,
			})),
		);
	}

	return (
		<>
			<div ref={containerRef} className="hidden sm:block">
				{mounted ? (
					<GridLayout
						width={width}
						layout={rglLayout}
						gridConfig={{
							cols: DASHBOARD.grid.cols,
							rowHeight: DASHBOARD.grid.rowHeightPx,
							margin: [10, 10],
						}}
						dragConfig={{ enabled: editing, handle: ".janus-widget-drag" }}
						resizeConfig={{ enabled: editing, handles: ["se"] }}
						compactor={verticalCompactor}
						onLayoutChange={handleLayoutChange}
					>
						{rglLayout.map((item) => {
							const widget = widgetsById.get(item.i);
							if (!widget) return null;
							const Component = widget.component;
							return (
								<div key={item.i}>
									<Component />
								</div>
							);
						})}
					</GridLayout>
				) : (
					<WidgetStack layout={layout} widgetsById={widgetsById} />
				)}
			</div>
			<div className="flex flex-col gap-4 sm:hidden">
				<WidgetStack layout={layout} widgetsById={widgetsById} />
			</div>
		</>
	);
}
