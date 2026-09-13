"use client";

import Certificate from "@carbon/icons-react/es/Certificate";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { LocalRelativeTime } from "@/components/local-date-time";
import { PermitStatusBadge } from "@/components/permits/permit-status-badge";
import {
	PERMIT_STATUS_LABEL,
	PERMIT_TYPE_LABEL,
} from "@/lib/permits/permit-status";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	PERMIT_STATUS_FILTERS,
	type PermitStatusFilter,
	permitsParsers,
} from "./permits-search-params";

type PermitRow = RouterOutputs["permits"]["list"]["rows"][number];

const COLUMNS: SimpleTableColumn[] = [
	{ id: "deal", header: "Deal", width: "w-[26%]" },
	{ id: "jurisdiction", header: "Jurisdiction", width: "w-[22%]" },
	{ id: "type", header: "Type", width: "w-[16%]" },
	{ id: "status", header: "Status", width: "w-[16%]" },
	{ id: "updated", header: "Updated", width: "w-[20%]", align: "right" },
];

const STATUS_LABELS: Record<PermitStatusFilter, string> = {
	all: "All statuses",
	...PERMIT_STATUS_LABEL,
};

function dealLabel(deal: PermitRow["deal"]): string {
	if (!deal) return "—";
	return `${deal.name} #${deal.number}`;
}

export function PermitsTable() {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const [permitStatus, setPermitStatus] = useQueryState(
		"permitStatus",
		permitsParsers.permitStatus,
	);

	const permits = useQuery({
		...trpc.permits.list.queryOptions({
			status: permitStatus === "all" ? undefined : permitStatus,
			page: 1,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = permits.data?.rows ?? [];

	return (
		<div className="flex flex-col gap-4">
			<Select
				value={permitStatus}
				onValueChange={(next) =>
					void setPermitStatus(next as PermitStatusFilter)
				}
			>
				<SelectTrigger className="w-56">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{PERMIT_STATUS_FILTERS.map((value) => (
						<SelectItem key={value} value={value}>
							{STATUS_LABELS[value]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{permits.isPending ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-10 w-full rounded-lg" />
					<Skeleton className="h-10 w-full rounded-lg" />
				</div>
			) : rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={Certificate} />
						</EmptyMedia>
						<EmptyTitle>No permits yet</EmptyTitle>
						<EmptyDescription>
							Permits pulled for a job show up here.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable columns={COLUMNS}>
					{rows.map((permit) => (
						<SimpleTableRow
							key={permit.id}
							clickable
							onClick={() => openRecord({ kind: "deal", id: permit.dealId })}
						>
							<TableCell className="truncate px-3 py-2.5 font-medium">
								{dealLabel(permit.deal)}
							</TableCell>
							<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
								{permit.jurisdiction.name}, {permit.jurisdiction.state}
							</TableCell>
							<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
								{permit.typeLabel || PERMIT_TYPE_LABEL[permit.permitType]}
							</TableCell>
							<TableCell className="px-3 py-2.5">
								<PermitStatusBadge status={permit.status} />
							</TableCell>
							<TableCell className="px-3 py-2.5 text-right text-muted-foreground">
								<LocalRelativeTime date={permit.updatedAt} />
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}
		</div>
	);
}
