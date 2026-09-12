"use client";

import type { CarbonIconType } from "@carbon/icons-react/es/CarbonIcon";
import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import { DropdownMenuItem } from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import { Slot } from "radix-ui";
import type * as React from "react";

function NavBar({ className, ...props }: React.ComponentProps<"nav">) {
	return (
		<nav
			data-slot="nav-bar"
			className={cn("flex items-center gap-1", className)}
			{...props}
		/>
	);
}

function NavBarItem({
	className,
	asChild = false,
	active = false,
	hasChildren = false,
	...props
}: React.ComponentProps<"a"> & {
	asChild?: boolean;
	active?: boolean;
	hasChildren?: boolean;
}) {
	const Comp = asChild ? Slot.Root : "a";

	return (
		<Comp
			data-slot="nav-bar-item"
			data-active={active}
			className={cn(
				"flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 aria-expanded:bg-muted aria-expanded:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground",
				hasChildren && "pr-1.5",
				className,
			)}
			{...props}
		/>
	);
}

function NavBarItemIcon({ icon }: { icon: CarbonIconType }) {
	return <Icon icon={icon} />;
}

function NavBarItemChevron() {
	return <Icon icon={ChevronDown} className="size-3" />;
}

function NavBarChildItem({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
	return (
		<DropdownMenuItem
			data-slot="nav-bar-child-item"
			className={cn("text-xs", className)}
			{...props}
		/>
	);
}

export {
	NavBar,
	NavBarItem,
	NavBarItemChevron,
	NavBarItemIcon,
	NavBarChildItem,
};
