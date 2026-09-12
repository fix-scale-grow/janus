"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
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
import { usePrefetchSection } from "@/components/crm/section-prefetch";
import {
	isNavChildActive,
	isNavItemActive,
	type NavItem,
	useNavItems,
} from "@/components/nav/use-nav-items";

export function TopNav() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const prefetchSection = usePrefetchSection();
	const { items } = useNavItems();

	return (
		<NavBar className="min-w-0 overflow-x-auto">
			{items.map((item) => (
				<TopNavItem
					key={item.section}
					item={item}
					pathname={pathname}
					searchParams={searchParams}
					onPrefetch={() => prefetchSection(item.section)}
				/>
			))}
		</NavBar>
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
