"use client";

import CurrencyDollar from "@carbon/icons-react/es/CurrencyDollar";
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
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import {
	type InvoiceStatusFilter,
	invoicesSearchParams,
} from "./invoices-search-params";

type InvoiceRow = RouterOutputs["invoices"]["list"]["rows"][number];

const STATUS_TABS: { value: InvoiceStatusFilter; label: string }[] = [
	{ value: "DRAFT", label: "Draft" },
	{ value: "SENT", label: "Sent" },
	{ value: "PAID", label: "Paid" },
	{ value: "VOID", label: "Void" },
];

const STATUS_LABEL: Record<InvoiceRow["status"], string> = {
	DRAFT: "Draft",
	SENT: "Sent",
	PAID: "Paid",
	VOID: "Void",
};

const STATUS_VARIANT: Record<
	InvoiceRow["status"],
	"secondary" | "outline" | "destructive"
> = {
	DRAFT: "secondary",
	SENT: "outline",
	PAID: "outline",
	VOID: "destructive",
};

const AGING_LABEL: Record<NonNullable<InvoiceRow["aging"]>, string> = {
	current: "Current",
	due_soon: "Due soon",
	overdue: "Overdue",
};

function StatusBadge({ status }: { status: InvoiceRow["status"] }) {
	return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

function AgingBadge({ aging }: { aging: InvoiceRow["aging"] }) {
	if (!aging || aging === "current") return <EmptyCellValue />;
	return (
		<Badge variant={aging === "overdue" ? "destructive" : "secondary"}>
			{AGING_LABEL[aging]}
		</Badge>
	);
}

export function InvoicesTable({
	dealId,
	contactId,
}: {
	dealId?: string;
	contactId?: string;
} = {}) {
	return dealId || contactId ? (
		<EmbeddedInvoicesTable dealId={dealId} contactId={contactId} />
	) : (
		<PageInvoicesTable />
	);
}

function PageInvoicesTable() {
	const router = useRouter();
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const { query, input } = useTableQuery(invoicesSearchParams);
	const status = input.status as InvoiceStatusFilter;

	const invoices = useQuery({
		...trpc.invoices.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = invoices.data?.rows ?? [];

	const columns: DataTableColumn<InvoiceRow>[] = [
		{
			id: "number",
			header: "Number",
			sortable: true,
			hideable: false,
			width: "w-[10%]",
			cell: (row) => <span className="font-medium">#{row.number}</span>,
		},
		{
			id: "contact",
			header: "Contact",
			width: "w-[20%]",
			cell: (row) =>
				row.contactName ? (
					<span className="truncate">{row.contactName}</span>
				) : (
					<EmptyCellValue />
				),
		},
		{
			id: "status",
			header: "Status",
			sortable: true,
			width: "w-[12%]",
			cell: (row) => <StatusBadge status={row.status} />,
		},
		{
			id: "aging",
			header: "Aging",
			width: "w-[12%]",
			cell: (row) => <AgingBadge aging={row.aging} />,
		},
		{
			id: "total",
			header: "Total",
			align: "right",
			width: "w-[14%]",
			cell: (row) => (
				<span className="tabular-nums">
					{formatMoney(row.totalCents, row.currency)}
				</span>
			),
		},
		{
			id: "dueAt",
			header: "Due",
			sortable: true,
			align: "right",
			width: "w-[12%]",
			hideBelow: "md",
			cell: (row) =>
				row.dueAt ? (
					<span className="text-muted-foreground">
						<LocalDay date={row.dueAt} />
					</span>
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
			cell: (row) => <InvoiceRowMenu row={row} />,
		},
	];

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search invoices by number…" />}
			columns={columns}
			rows={rows}
			total={invoices.data?.total ?? 0}
			tabs={{
				id: "status",
				allLabel: "All invoices",
				options: STATUS_TABS,
			}}
			getRowId={(row) => row.id}
			loading={invoices.isFetching}
			onRowClick={(row) => router.push(workspaceUrl(`/invoices/${row.id}`))}
			empty="No invoices match this view."
		/>
	);
}

function EmbeddedInvoicesTable({
	dealId,
	contactId,
}: {
	dealId?: string;
	contactId?: string;
}) {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const invoices = useQuery({
		...trpc.invoices.list.queryOptions({
			q: "",
			sort: "updatedAt",
			dir: "desc",
			page: 1,
			pageSize: 50,
			dealId,
			contactId,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = invoices.data?.rows ?? [];

	if (invoices.isPending) {
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
						<Icon icon={CurrencyDollar} />
					</EmptyMedia>
					<EmptyTitle>No invoices</EmptyTitle>
					<EmptyDescription>
						Nothing has been billed for this job yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const columns: SimpleTableColumn[] = [
		{ id: "number", header: "Number", width: "w-20" },
		{ id: "status", header: "Status", width: "w-28" },
		{ id: "aging", header: "Aging", width: "w-28" },
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
					onClick={() => router.push(workspaceUrl(`/invoices/${row.id}`))}
				>
					<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
						#{row.number}
					</TableCell>
					<TableCell className="py-2.5 pr-3">
						<StatusBadge status={row.status} />
					</TableCell>
					<TableCell className="py-2.5 pr-3">
						<AgingBadge aging={row.aging} />
					</TableCell>
					<TableCell className="py-2.5 pr-3 text-right tabular-nums">
						{formatMoney(row.totalCents, row.currency)}
					</TableCell>
					<TableCell className="py-2.5 pr-3 text-right text-muted-foreground">
						<LocalRelativeTime date={row.updatedAt} />
					</TableCell>
					<TableCell className="py-2.5 pr-3">
						<InvoiceRowMenu row={row} />
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}

function InvoiceRowMenu({ row }: { row: InvoiceRow }) {
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
						<span className="sr-only">
							More actions for invoice #{row.number}
						</span>
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
			<DeleteInvoiceDialog
				invoiceId={row.id}
				number={row.number}
				open={deleting}
				onOpenChange={setDeleting}
			/>
		</>
	);
}

function DeleteInvoiceDialog({
	invoiceId,
	number,
	open,
	onOpenChange,
}: {
	invoiceId: string;
	number: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const remove = useMutation(
		trpc.invoices.delete.mutationOptions({
			onSuccess: () => {
				void cache.invoice();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete invoice #{number}?</AlertDialogTitle>
					<AlertDialogDescription>
						Its line items go too. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => remove.mutate({ id: invoiceId })}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
