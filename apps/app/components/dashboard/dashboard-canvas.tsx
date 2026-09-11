"use client";

import { DASHBOARD_LAYOUT_MAX, type DashboardLayoutEntry } from "@crm/db/user-views";
import { WidgetEditingProvider } from "@crm/ui/components/widget-shell";
import { type ComponentType, useMemo } from "react";
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

function EditableWidget({
	id,
	widget,
	editing,
	onRemove,
}: {
	id: string;
	widget: DashboardWidget;
	editing: boolean;
	onRemove: (id: string) => void;
}) {
	const Component = widget.component;
	return (
		<WidgetEditingProvider editing={editing} onRemove={() => onRemove(id)}>
			<Component />
		</WidgetEditingProvider>
	);
}

function WidgetStack({
	layout,
	widgetsById,
	editing,
	onRemove,
}: {
	layout: DashboardLayoutEntry[];
	widgetsById: Map<string, DashboardWidget>;
	editing: boolean;
	onRemove: (id: string) => void;
}) {
	return (
		<div className="flex flex-col gap-4">
			{sortByPosition(layout).map((entry) => {
				const widget = widgetsById.get(entry.id);
				if (!widget) return null;
				return (
					<EditableWidget
						key={entry.id}
						id={entry.id}
						widget={widget}
						editing={editing}
						onRemove={onRemove}
					/>
				);
			})}
		</div>
	);
}

export function DashboardCanvas({
	layout,
	widgets,
	editing,
	onLayoutChange,
	onRemove,
}: {
	layout: DashboardLayoutEntry[];
	widgets: DashboardWidget[];
	editing: boolean;
	onLayoutChange: (layout: DashboardLayoutEntry[]) => void;
	onRemove: (id: string) => void;
}) {
	const { width, containerRef, mounted } = useContainerWidth();
	const widgetsById = useMemo(
		() => new Map(widgets.map((widget) => [widget.id, widget])),
		[widgets],
	);

	const rglLayout: Layout = useMemo(
		() =>
			layout
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
						maxH: DASHBOARD_LAYOUT_MAX.h,
					};
				}),
		[layout, widgetsById],
	);

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
							return (
								<div key={item.i}>
									<EditableWidget
										id={item.i}
										widget={widget}
										editing={editing}
										onRemove={onRemove}
									/>
								</div>
							);
						})}
					</GridLayout>
				) : (
					<WidgetStack
						layout={layout}
						widgetsById={widgetsById}
						editing={editing}
						onRemove={onRemove}
					/>
				)}
			</div>
			<div className="flex flex-col gap-4 sm:hidden">
				<WidgetStack
					layout={layout}
					widgetsById={widgetsById}
					editing={editing}
					onRemove={onRemove}
				/>
			</div>
		</>
	);
}
