"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import {
	NavBar,
	NavBarChildItem,
	NavBarItem,
	NavBarItemIcon,
} from "@crm/ui/components/nav-bar";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { usePrefetchSection } from "@/components/crm/section-prefetch";
import {
	isNavChildActive,
	isNavItemActive,
	type NavItem,
	type NavPermissions,
	type NavPipelines,
	useNavItems,
} from "@/components/nav/use-nav-items";

const MORE_TRIGGER_FALLBACK_PX = 90;
const NAV_ITEM_GAP_PX = 4;

export function TopNav({
	initialPermissions,
	initialNavOrder,
	initialNavHidden,
	initialPipelines,
	initialPermitsEnabled,
}: {
	initialPermissions?: NavPermissions;
	initialNavOrder?: string[];
	initialNavHidden?: string[];
	initialPipelines?: NavPipelines;
	initialPermitsEnabled?: boolean;
} = {}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const prefetchSection = usePrefetchSection();
	const { items } = useNavItems({
		permissions: initialPermissions,
		navOrder: initialNavOrder,
		navHidden: initialNavHidden,
		pipelines: initialPipelines,
		permitsEnabled: initialPermitsEnabled,
	});

	const containerRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
	const moreRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState(items.length);

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		function measure() {
			if (!container) return;
			const containerWidth = container.clientWidth;
			const moreWidth =
				moreRef.current?.offsetWidth || MORE_TRIGGER_FALLBACK_PX;
			let used = 0;
			let count = items.length;

			for (let index = 0; index < items.length; index += 1) {
				const width = itemRefs.current[index]?.offsetWidth ?? 0;
				const gapBefore = index === 0 ? 0 : NAV_ITEM_GAP_PX;
				const hasMoreAfter = index < items.length - 1;
				const reserve = hasMoreAfter ? NAV_ITEM_GAP_PX + moreWidth : 0;
				if (used + gapBefore + width + reserve > containerWidth) {
					count = index;
					break;
				}
				used += gapBefore + width;
			}

			setVisibleCount(count);
		}

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(container);
		return () => observer.disconnect();
	}, [items]);

	const overflowItems = items.slice(visibleCount);

	return (
		<div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
			<div
				aria-hidden="true"
				className="invisible absolute inset-0 flex items-center gap-1"
			>
				{items.map((item, index) => (
					<div
						key={item.section}
						ref={(node) => {
							itemRefs.current[index] = node;
						}}
					>
						<TopNavItem
							item={item}
							pathname={pathname}
							searchParams={searchParams}
							onPrefetch={() => undefined}
						/>
					</div>
				))}
				<div ref={moreRef}>
					<NavBarItem>
						<Icon icon={OverflowMenuHorizontal} />
						More
					</NavBarItem>
				</div>
			</div>

			<NavBar className="min-w-0">
				{items.slice(0, visibleCount).map((item) => (
					<TopNavItem
						key={item.section}
						item={item}
						pathname={pathname}
						searchParams={searchParams}
						onPrefetch={() => prefetchSection(item.section)}
					/>
				))}
				{overflowItems.length > 0 ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<NavBarItem asChild>
								<button type="button">
									<Icon icon={OverflowMenuHorizontal} />
									More
								</button>
							</NavBarItem>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{overflowItems.map((item) => (
								<NavBarChildItem
									asChild
									key={item.section}
									active={isNavItemActive(item, pathname)}
								>
									<Link href={item.href}>{item.title}</Link>
								</NavBarChildItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</NavBar>
		</div>
	);
}

function TopNavItem({
	item,
	pathname,
	searchParams,
	onPrefetch,
}: {
	item: NavItem;
	pathname: string;
	searchParams: URLSearchParams;
	onPrefetch: () => void;
}) {
	const active = isNavItemActive(item, pathname);
	const children = item.children ?? [];

	return (
		<div className="flex shrink-0 items-center">
			<NavBarItem asChild active={active}>
				<Link
					href={item.href}
					prefetch
					onMouseEnter={onPrefetch}
					onFocus={onPrefetch}
					aria-current={active ? "page" : undefined}
				>
					<NavBarItemIcon icon={item.icon} />
					{item.title}
				</Link>
			</NavBarItem>
			{children.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon-2xs"
							aria-label={`${item.title} sections`}
							className="text-muted-foreground"
						>
							<Icon icon={ChevronDown} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{children.map((child) => (
							<NavBarChildItem
								asChild
								key={child.id}
								active={isNavChildActive(child, pathname, searchParams)}
							>
								<Link href={child.href}>{child.title}</Link>
							</NavBarChildItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}
