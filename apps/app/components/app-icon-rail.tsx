"use client";

import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import Close from "@carbon/icons-react/es/Close";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { NavBarChildItem } from "@crm/ui/components/nav-bar";
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
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type MouseEvent, useRef } from "react";
import { AgentBuilderSidebar } from "@/components/agent-builder/agent-builder-sidebar";
import { usePrefetchSection } from "@/components/crm/section-prefetch";
import { useMobileNav } from "@/components/mobile-nav";
import { QuickCreateMenu } from "@/components/nav/quick-create-menu";
import { RecentsMenu } from "@/components/nav/recents-menu";
import {
	isNavChildActive,
	isNavItemActive,
	type NavItem,
	useNavItems,
} from "@/components/nav/use-nav-items";
import { JANUS_LIVE_NAV } from "@/lib/janus-nav";

type RailItem = NavItem;

function isActive(item: RailItem, pathname: string): boolean {
	return isNavItemActive(item, pathname);
}

const isChildActive = isNavChildActive;

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

function RailChildrenTrigger({
	item,
	active,
}: {
	item: RailItem & { section: string };
	active: boolean;
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	if (!item.children || item.children.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-2xs"
					aria-label={`${item.title} sections`}
					className={cn(
						"absolute right-0 bottom-0 bg-background text-muted-foreground shadow-2xs hover:bg-muted hover:text-foreground",
						active && "text-foreground",
					)}
				>
					<Icon icon={ChevronRight} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="right" align="end">
				{item.children.map((child) => (
					<NavBarChildItem
						asChild
						key={child.id}
						active={isChildActive(child, pathname, searchParams)}
					>
						<Link href={child.href}>{child.title}</Link>
					</NavBarChildItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
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
		<div className="relative">
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
			<RailChildrenTrigger item={item} active={active} />
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

export function AppIconRailFallback({
	navLayout = "RAIL",
}: {
	navLayout?: "RAIL" | "TOP_BAR";
}) {
	if (navLayout === "TOP_BAR") return null;

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

export function AppIconRail({ navLayout }: { navLayout: "RAIL" | "TOP_BAR" }) {
	const pathname = usePathname();
	const { open, setOpen } = useMobileNav();
	const prefetchSection = usePrefetchSection();
	const { items, sectionIds, saveOrder } = useNavItems();
	const suppressClick = useRef(false);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

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
			{navLayout === "TOP_BAR" ? null : (
				<nav
					aria-label="Primary"
					className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r py-3 md:flex [view-transition-name:app-rail]"
				>
					<QuickCreateMenu variant="rail" />
					<RecentsMenu variant="rail" />
					<div className="my-1 h-px w-5 bg-border" />
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
			)}

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
