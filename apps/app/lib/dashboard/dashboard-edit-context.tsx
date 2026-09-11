"use client";

import type { DashboardLayoutEntry } from "@crm/db/user-views";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type ComponentType,
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import {
	addEntry,
	DEFAULT_LAYOUT,
	resolveLayout,
	type WidgetMeta,
} from "./layout";
import { useVisibleWidgets } from "./widget-registry";

export type DashboardWidget = WidgetMeta & { component: ComponentType };

type DashboardEditContextValue = {
	editing: boolean;
	layout: DashboardLayoutEntry[];
	widgets: DashboardWidget[];
	addable: DashboardWidget[];
	savePending: boolean;
	customise: () => void;
	cancel: () => void;
	done: () => void;
	reset: () => void;
	remove: (id: string) => void;
	add: (widget: DashboardWidget) => void;
	setLayout: (layout: DashboardLayoutEntry[]) => void;
};

const DashboardEditContext = createContext<DashboardEditContextValue | null>(
	null,
);

export function DashboardEditProvider({ children }: { children: ReactNode }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const view = useQuery(trpc.views.get.queryOptions({ tableId: "dashboard" }));
	const widgets = useVisibleWidgets();
	const save = useMutation(trpc.views.save.mutationOptions());
	const [draft, setDraft] = useState<DashboardLayoutEntry[] | null>(null);

	const resolved = useMemo(
		() => resolveLayout(view.data?.dashboardLayout, widgets),
		[view.data?.dashboardLayout, widgets],
	);

	const editing = draft !== null;
	const layout = draft ?? resolved;

	const addable = useMemo(() => {
		const present = new Set(layout.map((entry) => entry.id));
		return widgets.filter((widget) => !present.has(widget.id));
	}, [widgets, layout]);

	const value: DashboardEditContextValue = {
		editing,
		layout,
		widgets,
		addable,
		savePending: save.isPending,
		customise: () => setDraft(resolved),
		cancel: () => setDraft(null),
		done: () => {
			if (draft === null) return;
			save.mutate(
				{
					tableId: "dashboard",
					state: { ...view.data, dashboardLayout: draft },
				},
				{
					onSuccess: async () => {
						try {
							await cache.views("dashboard", { settle: "record" });
						} catch (error) {
							void error;
						}
						toast.success("Layout saved");
						setDraft(null);
					},
					onError: (error) => {
						toast.error(error.message);
					},
				},
			);
		},
		reset: () => {
			const widgetIds = new Set(widgets.map((widget) => widget.id));
			setDraft(DEFAULT_LAYOUT.filter((entry) => widgetIds.has(entry.id)));
		},
		remove: (id) => {
			setDraft((current) =>
				(current ?? resolved).filter((entry) => entry.id !== id),
			);
		},
		add: (widget) => {
			setDraft((current) => addEntry(current ?? resolved, widget));
		},
		setLayout: (next) => {
			setDraft((current) => (current === null ? current : next));
		},
	};

	return (
		<DashboardEditContext.Provider value={value}>
			{children}
		</DashboardEditContext.Provider>
	);
}

export function useDashboardEdit(): DashboardEditContextValue {
	const ctx = useContext(DashboardEditContext);
	if (!ctx) {
		throw new Error(
			"useDashboardEdit must be used within a DashboardEditProvider",
		);
	}
	return ctx;
}
