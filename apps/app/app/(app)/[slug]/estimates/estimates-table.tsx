"use client";

import Money from "@carbon/icons-react/es/Money";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DataTable, type DataTableColumn } from "@crm/ui/components/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Icon } from "@crm/ui/components/icon";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Skeleton } from "@crm/ui/components/skeleton";
import { TableCell } from "@crm/ui/components/table";
import { formatMoney } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import {
	type EstimateStatusFilter,
	estimatesSearchParams,
} from "./estimates-search-params";

type EstimateRow = RouterOutputs["estimates"]["list"]["rows"][number];

const STATUS_TABS: { value: EstimateStatusFilter; label: string }[] = [
	{ value: "DRAFT", label: "Draft" },
	{ value: "SENT", label: "Sent" },
	{ value: "ACCEPTED", label: "Accepted" },
	{ value: "DECLINED", label: "Declined" },
];

const STATUS_LABEL: Record<EstimateRow["status"], string> = {
	DRAFT: "Draft",
	SENT: "Sent",
	ACCEPTED: "Accepted",
	DECLINED: "Declined",
};

const STATUS_VARIANT: Record<
	EstimateRow["status"],
	"secondary" | "outline" | "destructive"
> = {
	DRAFT: "secondary",
	SENT: "outline",
	ACCEPTED: "outline",
	DECLINED: "destructive",
};

function StatusBadge({ status }: { status: EstimateRow["status"] }) {
	return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function EstimatesTable({ dealId }: { dealId?: string } = {}) {
	return dealId ? (
		<EmbeddedEstimatesTable dealId={dealId} />
	) : (
		<PageEstimatesTable />
	);
}

function PageEstimatesTable() {
	const router = useRouter();
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const { query, input } = useTableQuery(estimatesSearchParams);
	const status = input.status as EstimateStatusFilter;

	const estimates = useQuery({
		...trpc.estimates.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = estimates.data?.rows ?? [];

	const columns: DataTableColumn<EstimateRow>[] = [
		{
			id: "title",
			header: "Title",
			sortable: true,
			hideable: false,
			width: "w-[28%]",
			cell: (row) => <span className="truncate font-medium">{row.title}</span>,
		},
		{
			id: "status",
			header: "Status",
			sortable: true,
			width: "w-[14%]",
			cell: (row) => <StatusBadge status={row.status} />,
		},
		{
			id: "total",
			header: "Total",
			sortable: true,
			align: "right",
			width: "w-[16%]",
			cell: (row) => (
				<span className="tabular-nums">
					{formatMoney(row.totalBetterCents, row.currency)}
				</span>
			),
		},
		{
			id: "deal",
			header: "Deal",
			width: "w-[22%]",
			hideBelow: "md",
			cell: (row) =>
				row.dealName ? (
					<span className="truncate text-muted-foreground">{row.dealName}</span>
				) : (
					<EmptyCellValue />
				),
		},
		{
			id: "updatedAt",
			header: "Updated",
			sortable: true,
			align: "right",
			width: "w-[12%]",
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-muted-foreground">
					<LocalRelativeTime date={row.updatedAt} />
				</span>
			),
		},
		{
			id: "actions",
			header: <span className="sr-only">Actions</span>,
			label: "Actions",
			hideable: false,
			align: "right",
			width: "w-[6%]",
			cell: (row) => <EstimateRowMenu row={row} />,
		},
	];

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search estimates by title…" />}
			columns={columns}
			rows={rows}
			total={estimates.data?.total ?? 0}
			tabs={{
				id: "status",
				allLabel: "All estimates",
				options: STATUS_TABS,
			}}
			getRowId={(row) => row.id}
			loading={estimates.isFetching}
			onRowClick={(row) => router.push(workspaceUrl(`/estimates/${row.id}`))}
			empty="No estimates match this view."
		/>
	);
}

function EmbeddedEstimatesTable({ dealId }: { dealId: string }) {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const estimates = useQuery({
		...trpc.estimates.list.queryOptions({
			q: "",
			sort: "updatedAt",
			dir: "desc",
			page: 1,
			pageSize: 50,
			dealId,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = estimates.data?.rows ?? [];

	if (estimates.isPending) {
		return (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-10 w-full rounded-lg" />
				<Skeleton className="h-10 w-full rounded-lg" />
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={Money} />
					</EmptyMedia>
					<EmptyTitle>No estimates</EmptyTitle>
					<EmptyDescription>
						Nothing has been priced for this job yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const columns: SimpleTableColumn[] = [
		{ id: "title", header: "Title" },
		{ id: "status", header: "Status", width: "w-28" },
		{ id: "total", header: "Total", width: "w-28", align: "right" },
		{ id: "updated", header: "Updated", width: "w-32", align: "right" },
		{ id: "actions", srLabel: "Actions", width: "w-10" },
	];

	return (
		<SimpleTable variant="panel" columns={columns}>
			{rows.map((row) => (
				<SimpleTableRow
					key={row.id}
					clickable
					onClick={() => router.push(workspaceUrl(`/estimates/${row.id}`))}
				>
					<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
						{row.title}
					</TableCell>
					<TableCell className="py-2.5 pr-3">
						<StatusBadge status={row.status} />
					</TableCell>
					<TableCell className="py-2.5 pr-3 text-right tabular-nums">
						{formatMoney(row.totalBetterCents, row.currency)}
					</TableCell>
					<TableCell className="py-2.5 pr-3 text-right text-muted-foreground">
						<LocalRelativeTime date={row.updatedAt} />
					</TableCell>
					<TableCell className="py-2.5 pr-3">
						<EstimateRowMenu row={row} />
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}

function EstimateRowMenu({ row }: { row: EstimateRow }) {
	const [deleting, setDeleting] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={(event) => event.stopPropagation()}
					>
						<Icon icon={OverflowMenuVertical} />
						<span className="sr-only">More actions for {row.title}</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="min-w-40"
					onClick={(event) => event.stopPropagation()}
				>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setDeleting(true)}
					>
						<Icon icon={TrashCan} />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<DeleteEstimateDialog
				estimateId={row.id}
				title={row.title}
				open={deleting}
				onOpenChange={setDeleting}
			/>
		</>
	);
}

function DeleteEstimateDialog({
	estimateId,
	title,
	open,
	onOpenChange,
}: {
	estimateId: string;
	title: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const remove = useMutation(
		trpc.estimates.delete.mutationOptions({
			onSuccess: () => {
				void cache.estimate();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {title}?</AlertDialogTitle>
					<AlertDialogDescription>
						Its line items go too. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => remove.mutate({ id: estimateId })}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
