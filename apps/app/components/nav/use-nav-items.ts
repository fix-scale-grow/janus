"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	JANUS_LIVE_NAV,
	type LiveNavItem,
	type NavChild,
} from "@/lib/janus-nav";
import { applyNavHidden, isChildHidden } from "@/lib/nav-children";
import { applyNavOrder } from "@/lib/nav-order";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export type NavItem = LiveNavItem & { section: string };

type Pipeline = RouterOutputs["pipelines"]["list"][number];
type Permissions = RouterOutputs["permissions"]["mine"];
type NavView = RouterOutputs["views"]["get"];

export type NavPermissions = Permissions;

export const DEALS_MODULE_HREF = "/deals";

export type NavItemsSeed = {
	permissions?: Permissions;
	navOrder?: string[];
	navHidden?: string[];
};

function seedPermissions(seed?: NavItemsSeed): Permissions | undefined {
	return seed?.permissions;
}

function seedNavView(seed?: NavItemsSeed): NavView | undefined {
	if (seed?.navOrder === undefined && seed?.navHidden === undefined) {
		return undefined;
	}
	return { navOrder: seed.navOrder, navHidden: seed.navHidden };
}

function useVisibleItems(seed?: NavItemsSeed): LiveNavItem[] {
	const trpc = useTRPC();
	const initialData = seedPermissions(seed);
	const permissions = useQuery({
		...trpc.permissions.mine.queryOptions(),
		...(initialData ? { initialData } : {}),
	});
	const keys = permissions.data?.keys;

	return useMemo(
		() =>
			JANUS_LIVE_NAV.filter(
				(item) =>
					!item.permission || (keys?.includes(item.permission) ?? false),
			),
		[keys],
	);
}

function useNavOrder(seed?: NavItemsSeed): {
	order: string[] | undefined;
	saveOrder: (next: string[]) => void;
} {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [pending, setPending] = useState<string[] | undefined>(undefined);
	const initialData = seedNavView(seed);
	const view = useQuery({
		...trpc.views.get.queryOptions({ tableId: "nav" }),
		...(initialData ? { initialData } : {}),
	});
	const save = useMutation(trpc.views.save.mutationOptions());

	const saveOrder = (next: string[]) => {
		setPending(next);
		if (view.isPending) return;
		save.mutate(
			{ tableId: "nav", state: { ...view.data, navOrder: next } },
			{ onSuccess: () => void cache.views("nav", { settle: "record" }) },
		);
	};

	return { order: pending ?? view.data?.navOrder, saveOrder };
}

function useNavHidden(seed?: NavItemsSeed): string[] | undefined {
	const trpc = useTRPC();
	const initialData = seedNavView(seed);
	const view = useQuery({
		...trpc.views.get.queryOptions({ tableId: "nav" }),
		...(initialData ? { initialData } : {}),
	});

	return view.data?.navHidden;
}

function useDealsStageChildren(): NavChild[] {
	const trpc = useTRPC();
	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: false }),
	);

	return useMemo(() => {
		const active: Pipeline | undefined =
			pipelines.data?.find((pipeline) => pipeline.archivedAt === null) ??
			pipelines.data?.[0];

		return (active?.stages ?? []).map((stage) => ({
			id: `${DEALS_MODULE_HREF}:${stage.id}`,
			title: stage.label,
			href: `${DEALS_MODULE_HREF}?stage=${stage.id}`,
		}));
	}, [pipelines.data]);
}

export function isNavItemActive(
	item: { href: string; match: "exact" | "prefix"; related?: string[] },
	pathname: string,
): boolean {
	return (
		pathname === item.href ||
		(item.match === "prefix" && pathname.startsWith(item.href)) ||
		Boolean(item.related?.some((prefix) => pathname.startsWith(prefix)))
	);
}

export function isNavChildActive(
	child: NavChild,
	pathname: string,
	searchParams: URLSearchParams,
): boolean {
	const [childPath, childQuery] = child.href.split("?");
	if (childPath !== pathname) return false;
	if (!childQuery) return true;

	return Array.from(new URLSearchParams(childQuery)).every(
		([key, value]) => searchParams.get(key) === value,
	);
}

export function useNavItems(seed?: NavItemsSeed): {
	items: NavItem[];
	sectionIds: string[];
	order: string[] | undefined;
	saveOrder: (next: string[]) => void;
} {
	const workspaceUrl = useWorkspaceUrl();
	const visible = useVisibleItems(seed);
	const { order, saveOrder } = useNavOrder(seed);
	const hidden = useNavHidden(seed);
	const dealsStageChildren = useDealsStageChildren();

	const items = useMemo(
		() =>
			applyNavOrder(applyNavHidden(visible, hidden), order).map((item) => {
				const children = (
					item.href === DEALS_MODULE_HREF ? dealsStageChildren : item.children
				)?.filter((child) => !isChildHidden(child.id, hidden));

				return {
					...item,
					section: item.href,
					href: workspaceUrl(item.href),
					related: item.related?.map((path) => workspaceUrl(path)),
					children: children?.map((child) => ({
						...child,
						href: workspaceUrl(child.href),
					})),
				};
			}),
		[visible, order, hidden, dealsStageChildren, workspaceUrl],
	);

	const sectionIds = useMemo(() => items.map((item) => item.section), [items]);

	return { items, sectionIds, order, saveOrder };
}
