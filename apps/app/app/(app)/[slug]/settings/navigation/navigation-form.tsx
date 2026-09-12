"use client";

import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@crm/ui/components/collapsible";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { SortableItem, SortableList } from "@crm/ui/components/sortable-list";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { DEALS_MODULE_HREF } from "@/components/nav/use-nav-items";
import {
	JANUS_LIVE_NAV,
	type LiveNavItem,
	type NavChild,
} from "@/lib/janus-nav";
import { HIDE_PROOF, isChildHidden } from "@/lib/nav-children";
import { applyNavOrder } from "@/lib/nav-order";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type NavView = RouterOutputs["views"]["get"];
type Pipeline = RouterOutputs["pipelines"]["list"][number];

type NavItem = LiveNavItem;

function toggled(list: string[], value: string): string[] {
	return list.includes(value)
		? list.filter((entry) => entry !== value)
		: [...list, value];
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

export function NavigationForm() {
	return (
		<>
			<NavLayoutCard />
			<NavMenuCard />
			<JobNumbersCard />
		</>
	);
}

function NavLayoutCard() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();

	const permissions = useQuery(trpc.permissions.mine.queryOptions());
	const layout = useQuery(trpc.settings.navLayout.queryOptions());
	const isAdmin = permissions.data?.isAdmin ?? false;

	const save = useMutation(
		trpc.settings.setNavLayout.mutationOptions({
			onSuccess: async () => {
				await cache.settings();
				router.refresh();
				toast.success("Navigation layout saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Position</CardTitle>
				<CardDescription>Where the navigation sits in the app.</CardDescription>
			</CardHeader>

			<CardContent>
				<FieldGroup>
					<Field>
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							spacing={0}
							value={layout.data?.layout ?? "RAIL"}
							disabled={!isAdmin || save.isPending}
							onValueChange={(next) => {
								if (next === "RAIL" || next === "TOP_BAR") {
									save.mutate({ layout: next });
								}
							}}
							aria-label="Navigation position"
						>
							<ToggleGroupItem value="RAIL">Left rail</ToggleGroupItem>
							<ToggleGroupItem value="TOP_BAR">Top bar</ToggleGroupItem>
						</ToggleGroup>
						{isAdmin ? null : (
							<FieldDescription>
								Only an owner or an admin can change this.
							</FieldDescription>
						)}
					</Field>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}

function NavMenuCard() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const permissions = useQuery(trpc.permissions.mine.queryOptions());
	const view = useQuery(trpc.views.get.queryOptions({ tableId: "nav" }));
	const dealsStageChildren = useDealsStageChildren();
	const save = useMutation(trpc.views.save.mutationOptions());
	const reset = useMutation(
		trpc.views.reset.mutationOptions({
			onSuccess: () => {
				setPending(null);
				void cache.views("nav");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const [pending, setPending] = useState<NavView | null>(null);

	const current = pending ?? view.data ?? null;
	const order = current?.navOrder;
	const hidden = current?.navHidden;

	const commit = (
		patch: Partial<{ navOrder: string[]; navHidden: string[] }>,
	) => {
		const next = { ...current, ...patch };
		setPending(next);
		if (view.isPending) return;
		save.mutate(
			{ tableId: "nav", state: { ...view.data, ...patch } },
			{ onSuccess: () => void cache.views("nav", { settle: "record" }) },
		);
	};

	const visible = useMemo(
		() =>
			JANUS_LIVE_NAV.filter(
				(item) =>
					!item.permission ||
					(permissions.data?.keys.includes(item.permission) ?? false),
			),
		[permissions.data],
	);

	const items = useMemo(
		() =>
			applyNavOrder(visible, order).map((item) => ({
				...item,
				children:
					item.href === DEALS_MODULE_HREF ? dealsStageChildren : item.children,
			})),
		[visible, order, dealsStageChildren],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Menu items</CardTitle>
				<CardDescription>
					Drag to reorder. Hide the ones this workspace does not use.
				</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => reset.mutate({ tableId: "nav" })}
						disabled={reset.isPending}
					>
						{reset.isPending ? <Spinner data-icon="inline-start" /> : null}
						Reset to default
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<SortableList
					ids={items.map((item) => item.href)}
					onReorder={(ids) => commit({ navOrder: ids })}
				>
					<div className="flex flex-col divide-y rounded-lg border">
						{items.map((item) => (
							<SortableItem
								key={item.href}
								id={item.href}
								label={item.title}
								className="px-3 py-2"
							>
								<NavModuleRow
									item={item}
									hidden={Boolean(hidden?.includes(item.href))}
									hiddenChildren={hidden ?? []}
									locked={HIDE_PROOF.includes(item.href)}
									isDealsModule={item.href === DEALS_MODULE_HREF}
									onToggleModule={() =>
										commit({ navHidden: toggled(hidden ?? [], item.href) })
									}
									onToggleChild={(childId) =>
										commit({ navHidden: toggled(hidden ?? [], childId) })
									}
								/>
							</SortableItem>
						))}
					</div>
				</SortableList>
			</CardContent>
		</Card>
	);
}

function NavModuleRow({
	item,
	hidden,
	hiddenChildren,
	locked,
	isDealsModule,
	onToggleModule,
	onToggleChild,
}: {
	item: NavItem;
	hidden: boolean;
	hiddenChildren: string[];
	locked: boolean;
	isDealsModule: boolean;
	onToggleModule: () => void;
	onToggleChild: (childId: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const children = item.children ?? [];
	const switchId = useId();

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="flex-1">
			<div className="flex flex-1 items-center gap-2.5">
				<Icon icon={item.icon} className="shrink-0 text-muted-foreground" />
				<span className="flex-1 truncate text-sm font-medium">
					{item.title}
				</span>

				{locked ? (
					<span className="text-muted-foreground text-xs">Always shown</span>
				) : (
					<Switch
						id={switchId}
						checked={!hidden}
						onCheckedChange={() => onToggleModule()}
						aria-label={`Show ${item.title} in navigation`}
					/>
				)}

				{children.length > 0 ? (
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="icon-xs" className="shrink-0">
							<Icon
								icon={ChevronRight}
								className={cn("transition-transform", open && "rotate-90")}
							/>
							<span className="sr-only">{item.title} children</span>
						</Button>
					</CollapsibleTrigger>
				) : null}
			</div>

			{children.length > 0 ? (
				<CollapsibleContent>
					<div className="mt-2 flex flex-col gap-2 border-l pl-6">
						{children.map((child) => (
							<div key={child.id} className="flex items-center gap-2.5">
								<span className="flex-1 truncate text-muted-foreground text-sm">
									{child.title}
								</span>
								{isDealsModule ? null : (
									<Switch
										checked={!isChildHidden(child.id, hiddenChildren)}
										onCheckedChange={() => onToggleChild(child.id)}
										aria-label={`Show ${child.title} in navigation`}
									/>
								)}
							</div>
						))}
						{isDealsModule ? (
							<FieldDescription>
								Manage stages in Pipeline settings.
							</FieldDescription>
						) : null}
					</div>
				</CollapsibleContent>
			) : null}
		</Collapsible>
	);
}

function JobNumbersCard() {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const permissions = useQuery(trpc.permissions.mine.queryOptions());
	const numbering = useQuery(trpc.settings.dealNumbering.queryOptions());
	const isAdmin = permissions.data?.isAdmin ?? false;

	const [start, setStart] = useState("");
	const startId = useId();

	const save = useMutation(
		trpc.settings.setDealNumberStart.mutationOptions({
			onSuccess: async () => {
				await cache.settings();
				setStart("");
				toast.success("Job numbering saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const parsed = Number(start);
	const ready = start.trim() !== "" && Number.isInteger(parsed) && parsed > 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Job numbers</CardTitle>
				<CardDescription>The number the next new job gets.</CardDescription>
			</CardHeader>

			<CardContent>
				<FieldGroup>
					<Field>
						<FieldLabel>Next number</FieldLabel>
						<p className="font-medium text-sm tabular-nums">
							{numbering.data ? `#${numbering.data.nextNumber}` : "—"}
						</p>
					</Field>

					<Field>
						<FieldLabel htmlFor={startId}>Start at</FieldLabel>
						<div className="flex items-center gap-2">
							<Input
								id={startId}
								value={start}
								onChange={(event) => setStart(event.target.value)}
								inputMode="numeric"
								autoComplete="off"
								placeholder={String(numbering.data?.nextNumber ?? "")}
								disabled={!isAdmin || save.isPending}
								className="w-32"
							/>
							<Button
								type="button"
								size="sm"
								disabled={!isAdmin || save.isPending || !ready}
								onClick={() => save.mutate({ start: parsed })}
							>
								{save.isPending ? <Spinner data-icon="inline-start" /> : null}
								Save
							</Button>
						</div>
						<FieldDescription>
							Job numbers can only move forward.
						</FieldDescription>
					</Field>

					{isAdmin ? null : (
						<p className="text-muted-foreground text-xs">
							Only an owner or an admin can change this.
						</p>
					)}
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
