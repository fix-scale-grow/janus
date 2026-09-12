"use client";

import {
	DASHBOARD_LAYOUT_MAX,
	type DashboardLayoutEntry,
} from "@crm/db/user-views";
import { WidgetEditingProvider } from "@crm/ui/components/widget-shell";
import {
	type ComponentType,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
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

const DESKTOP_MEDIA_QUERY = "(min-width: 640px)";
const GRID_MARGIN: [number, number] = [10, 10];

function subscribeToDesktopBreakpoint(callback: () => void) {
	const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
	mql.addEventListener("change", callback);
	return () => mql.removeEventListener("change", callback);
}

function getIsDesktopSnapshot() {
	return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getIsDesktopServerSnapshot() {
	return null;
}

function useIsDesktopBreakpoint(): boolean | null {
	return useSyncExternalStore(
		subscribeToDesktopBreakpoint,
		getIsDesktopSnapshot,
		getIsDesktopServerSnapshot,
	);
}

function useMeasuredHeight(
	ref: { current: HTMLDivElement | null },
	watch: unknown,
): number {
	const [height, setHeight] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: watch forces a remeasure when the breakpoint flips, the body reads ref.current not watch itself
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const measure = () =>
			setHeight(Math.round(node.getBoundingClientRect().height));
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [ref, watch]);
	return height;
}

function GridGuides({
	width,
	cols,
	rowHeightPx,
	marginX,
	marginY,
	heightPx,
}: {
	width: number;
	cols: number;
	rowHeightPx: number;
	marginX: number;
	marginY: number;
	heightPx: number;
}) {
	const colWidth = Math.max(0, (width - marginX * (cols + 1)) / cols);
	const columnLines = useMemo(() => {
		const lines: number[] = [];
		for (let i = 0; i < cols; i++) {
			const start = (colWidth + marginX) * i + marginX;
			lines.push(start, start + colWidth);
		}
		return lines;
	}, [cols, colWidth, marginX]);

	const rows = Math.max(
		0,
		Math.round((heightPx - marginY) / (rowHeightPx + marginY)),
	);
	const rowLines = useMemo(() => {
		const lines: number[] = [];
		for (let j = 0; j < rows; j++) {
			const start = (rowHeightPx + marginY) * j + marginY;
			lines.push(start, start + rowHeightPx);
		}
		return lines;
	}, [rows, rowHeightPx, marginY]);

	if (heightPx <= 0) return null;

	return (
		<div
			className="pointer-events-none absolute inset-0 opacity-50"
			style={{ height: heightPx }}
		>
			{columnLines.map((left) => (
				<div
					key={`col-${left}`}
					className="absolute top-0 w-px"
					style={{ left, height: heightPx, background: "var(--border)" }}
				/>
			))}
			{rowLines.map((top) => (
				<div
					key={`row-${top}`}
					className="absolute left-0 h-px"
					style={{ top, width, background: "var(--border)" }}
				/>
			))}
		</div>
	);
}

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
	const isDesktop = useIsDesktopBreakpoint();
	const gridHeight = useMeasuredHeight(containerRef, isDesktop);
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

	const grid = mounted ? (
		<GridLayout
			width={width}
			layout={rglLayout}
			gridConfig={{
				cols: DASHBOARD.grid.cols,
				rowHeight: DASHBOARD.grid.rowHeightPx,
				margin: GRID_MARGIN,
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
	);

	if (isDesktop === null) {
		return (
			<>
				<div ref={containerRef} className="hidden sm:block">
					{grid}
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

	if (!isDesktop) {
		return (
			<WidgetStack
				layout={layout}
				widgetsById={widgetsById}
				editing={editing}
				onRemove={onRemove}
			/>
		);
	}

	return (
		<div ref={containerRef} className="relative">
			{grid}
			{editing && mounted && (
				<GridGuides
					width={width}
					cols={DASHBOARD.grid.cols}
					rowHeightPx={DASHBOARD.grid.rowHeightPx}
					marginX={GRID_MARGIN[0]}
					marginY={GRID_MARGIN[1]}
					heightPx={gridHeight}
				/>
			)}
		</div>
	);
}
