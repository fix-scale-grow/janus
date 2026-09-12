"use client";

import type { CarbonIconType } from "@carbon/icons-react/es/CarbonIcon";
import CurrencyDollar from "@carbon/icons-react/es/CurrencyDollar";
import DocumentSigned from "@carbon/icons-react/es/DocumentSigned";
import EventSchedule from "@carbon/icons-react/es/EventSchedule";
import History from "@carbon/icons-react/es/History";
import Partnership from "@carbon/icons-react/es/Partnership";
import PenFountain from "@carbon/icons-react/es/PenFountain";
import Receipt from "@carbon/icons-react/es/Receipt";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { NavBarItem, NavBarItemIcon } from "@crm/ui/components/nav-bar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type RecentRow = RouterOutputs["recents"]["list"]["rows"][number];
type RecentKind = RecentRow["kind"];

const KIND_ICON: Record<RecentKind, CarbonIconType> = {
	contact: UserMultiple,
	deal: Partnership,
	drawing: PenFountain,
	estimate: Receipt,
	invoice: CurrencyDollar,
	contract: DocumentSigned,
	project: EventSchedule,
};

const KIND_PATH: Partial<Record<RecentKind, string>> = {
	drawing: "/drawings",
	estimate: "/estimates",
	invoice: "/invoices",
	contract: "/contracts",
	project: "/projects",
};

export function RecentsMenu({ variant }: { variant: "rail" | "bar" }) {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const openRecord = useOpenRecord();
	const recents = useQuery(trpc.recents.list.queryOptions());
	const rows = recents.data?.rows ?? [];

	function openRow(row: RecentRow) {
		if (row.kind === "contact" || row.kind === "deal") {
			openRecord({ kind: row.kind, id: row.recordId });
			return;
		}

		const base = KIND_PATH[row.kind];
		if (base) router.push(workspaceUrl(`${base}/${row.recordId}`));
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{variant === "rail" ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Recent"
								className="text-muted-foreground"
							>
								<Icon icon={History} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">Recent</TooltipContent>
					</Tooltip>
				) : (
					<NavBarItem asChild>
						<button type="button">
							<NavBarItemIcon icon={History} />
							Recent
						</button>
					</NavBarItem>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-56">
				{rows.length === 0 ? (
					<DropdownMenuItem disabled>No recent records yet.</DropdownMenuItem>
				) : (
					rows.map((row) => (
						<DropdownMenuItem
							key={`${row.kind}:${row.recordId}`}
							onSelect={() => openRow(row)}
						>
							<Icon icon={KIND_ICON[row.kind]} />
							<span className="truncate">{row.label}</span>
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
