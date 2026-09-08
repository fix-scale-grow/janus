"use client";

import Close from "@carbon/icons-react/es/Close";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	restrictToParentElement,
	restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MouseEvent, useMemo, useRef, useState } from "react";
import { AgentBuilderSidebar } from "@/components/agent-builder/agent-builder-sidebar";
import { usePrefetchSection } from "@/components/crm/section-prefetch";
import { useMobileNav } from "@/components/mobile-nav";
import { JANUS_LIVE_NAV, type LiveNavItem } from "@/lib/janus-nav";
import { applyNavOrder } from "@/lib/nav-order";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type RailItem = LiveNavItem;

function useVisibleItems(): RailItem[] {
	const trpc = useTRPC();
	const permissions = useQuery(trpc.permissions.mine.queryOptions());
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

function useNavOrder(): {
	order: string[] | undefined;
	saveOrder: (next: string[]) => void;
} {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [pending, setPending] = useState<string[] | undefined>(undefined);
	const view = useQuery(trpc.views.get.queryOptions({ tableId: "nav" }));
	const save = useMutation(trpc.views.save.mutationOptions());

	const saveOrder = (next: string[]) => {
		setPending(next);
		save.mutate(
			{ tableId: "nav", state: { navOrder: next } },
			{ onSuccess: () => void cache.views("nav", { settle: "record" }) },
		);
	};

	return { order: pending ?? view.data?.navOrder, saveOrder };
}

function isActive(item: RailItem, pathname: string): boolean {
	return (
		pathname === item.href ||
		(item.match === "prefix" && pathname.startsWith(item.href)) ||
		Boolean(item.related?.some((prefix) => pathname.startsWith(prefix)))
	);
}

function RailLink({
	item,
	active,
	onPrefetch,
	onLinkClick,
}: {
	item: RailItem;
	active: boolean;
	onPrefetch: () => void;
	onLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					asChild
					variant="ghost"
					size="icon"
					className={cn(
						"text-muted-foreground",
						active &&
							"bg-muted text-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					<Link
						href={item.href}
						prefetch
						onMouseEnter={onPrefetch}
						onFocus={onPrefetch}
						onClick={onLinkClick}
						aria-current={active ? "page" : undefined}
						transitionTypes={["nav-lateral"]}
					>
						<Icon icon={item.icon} />
						<span className="sr-only">{item.title}</span>
					</Link>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="right">
				{item.title} · drag to reorder
			</TooltipContent>
		</Tooltip>
	);
}

function SortableRailLink({
	item,
	active,
	onPrefetch,
	suppressClick,
}: {
	item: RailItem & { section: string };
	active: boolean;
	onPrefetch: () => void;
	suppressClick: { current: boolean };
}) {
	const { listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: item.section });

	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn("touch-none", isDragging && "relative z-10 opacity-60")}
			{...listeners}
		>
			<RailLink
				item={item}
				active={active}
				onPrefetch={onPrefetch}
				onLinkClick={(event) => {
					if (suppressClick.current) {
						suppressClick.current = false;
						event.preventDefault();
					}
				}}
			/>
		</div>
	);
}

function MobileRailLink({
	item,
	active,
	onNavigate,
	onPrefetch,
}: {
	item: RailItem;
	active: boolean;
	onNavigate: () => void;
	onPrefetch: () => void;
}) {
	return (
		<Button
			asChild
			variant="ghost"
			className={cn(
				"justify-start gap-3 text-muted-foreground",
				active &&
					"bg-muted text-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			<Link
				href={item.href}
				prefetch
				onMouseEnter={onPrefetch}
				onFocus={onPrefetch}
				aria-current={active ? "page" : undefined}
				onClick={onNavigate}
				transitionTypes={[
					item.title === "Janus AI" ? "nav-forward" : "nav-lateral",
				]}
			>
				<Icon icon={item.icon} />
				<span>{item.title}</span>
			</Link>
		</Button>
	);
}

function MobileRailIconLink({
	item,
	active,
	onNavigate,
	onPrefetch,
}: {
	item: RailItem;
	active: boolean;
	onNavigate: () => void;
	onPrefetch: () => void;
}) {
	return (
		<Button
			asChild
			variant="ghost"
			size="icon"
			className={cn(
				"text-muted-foreground",
				active &&
					"bg-muted text-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			<Link
				href={item.href}
				prefetch
				onMouseEnter={onPrefetch}
				onFocus={onPrefetch}
				aria-current={active ? "page" : undefined}
				onClick={onNavigate}
			>
				<Icon icon={item.icon} />
				<span className="sr-only">{item.title}</span>
			</Link>
		</Button>
	);
}

export function AppIconRailFallback() {
	return (
		<nav
			aria-label="Primary"
			aria-busy="true"
			className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r py-3 md:flex [view-transition-name:app-rail]"
		>
			{JANUS_LIVE_NAV.filter((item) => !item.permission).map((item) => (
				<Button
					key={item.href}
					variant="ghost"
					size="icon"
					disabled
					className="text-muted-foreground"
				>
					<Icon icon={item.icon} />
					<span className="sr-only">{item.title}</span>
				</Button>
			))}
		</nav>
	);
}

export function AppIconRail() {
	const pathname = usePathname();
	const workspaceUrl = useWorkspaceUrl();
	const { open, setOpen } = useMobileNav();
	const prefetchSection = usePrefetchSection();
	const visible = useVisibleItems();
	const { order, saveOrder } = useNavOrder();
	const suppressClick = useRef(false);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const items = useMemo(
		() =>
			applyNavOrder(visible, order).map((item) => ({
				...item,
				section: item.href,
				href: workspaceUrl(item.href),
				related: item.related?.map((path) => workspaceUrl(path)),
			})),
		[visible, order, workspaceUrl],
	);
	const sectionIds = useMemo(() => items.map((item) => item.section), [items]);
	const inChat = items.some(
		(item) => item.title === "Janus AI" && isActive(item, pathname),
	);

	function handleDragEnd(event: DragEndEvent) {
		suppressClick.current = true;
		setTimeout(() => {
			suppressClick.current = false;
		}, 300);

		const overId = event.over?.id;
		if (overId == null || event.active.id === overId) return;

		const from = sectionIds.indexOf(String(event.active.id));
		const to = sectionIds.indexOf(String(overId));
		if (from === -1 || to === -1) return;

		saveOrder(arrayMove(sectionIds, from, to));
	}

	return (
		<>
			<nav
				aria-label="Primary"
				className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r py-3 md:flex [view-transition-name:app-rail]"
			>
				<DndContext
					id="app-rail-sort"
					sensors={sensors}
					collisionDetection={closestCenter}
					modifiers={[restrictToVerticalAxis, restrictToParentElement]}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={sectionIds}
						strategy={verticalListSortingStrategy}
					>
						{items.map((item) => (
							<SortableRailLink
								key={item.section}
								item={item}
								active={isActive(item, pathname)}
								onPrefetch={() => prefetchSection(item.section)}
								suppressClick={suppressClick}
							/>
						))}
					</SortableContext>
				</DndContext>
			</nav>

			<Sheet open={open} onOpenChange={setOpen}>
				{inChat ? (
					<SheetContent
						side="left"
						showCloseButton={false}
						className="w-5/6 max-w-sm flex-row gap-0 p-0"
					>
						<SheetHeader className="sr-only">
							<SheetTitle>Navigation and agent chats</SheetTitle>
						</SheetHeader>
						<nav
							aria-label="Primary"
							className="flex w-14 shrink-0 flex-col items-center gap-1 border-r py-3"
						>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Close navigation"
								onClick={() => setOpen(false)}
							>
								<Icon icon={Close} />
							</Button>
							<div className="my-1 h-px w-5 bg-border" />
							{items.map((item) => (
								<MobileRailIconLink
									key={item.href}
									item={item}
									active={isActive(item, pathname)}
									onNavigate={() => setOpen(false)}
									onPrefetch={() => prefetchSection(item.section)}
								/>
							))}
						</nav>
						<AgentBuilderSidebar
							className="flex flex-1"
							onNavigate={() => setOpen(false)}
						/>
					</SheetContent>
				) : (
					<SheetContent side="left" className="w-64 gap-0 p-0">
						<SheetHeader>
							<SheetTitle>Navigation</SheetTitle>
						</SheetHeader>
						<nav
							aria-label="Primary"
							className="flex flex-1 flex-col gap-1 p-2"
						>
							{items.map((item) => (
								<MobileRailLink
									key={item.href}
									item={item}
									active={isActive(item, pathname)}
									onNavigate={() => setOpen(false)}
									onPrefetch={() => prefetchSection(item.section)}
								/>
							))}
						</nav>
					</SheetContent>
				)}
			</Sheet>
		</>
	);
}
