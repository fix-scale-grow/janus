"use client";

import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import DocumentSigned from "@carbon/icons-react/es/DocumentSigned";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DataTable, type DataTableColumn } from "@crm/ui/components/data-table";
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
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import {
	type ContractStatusFilter,
	contractsSearchParams,
} from "./contracts-search-params";

type ContractRow = RouterOutputs["contracts"]["list"]["rows"][number];

const STATUS_TABS: { value: ContractStatusFilter; label: string }[] = [
	{ value: "DRAFT", label: "Draft" },
	{ value: "SENT", label: "Sent" },
	{ value: "SIGNED", label: "Signed" },
	{ value: "VOID", label: "Void" },
];

const STATUS_LABEL: Record<ContractRow["status"], string> = {
	DRAFT: "Draft",
	SENT: "Sent",
	SIGNED: "Signed",
	VOID: "Void",
};

const STATUS_VARIANT: Record<ContractRow["status"], "secondary" | "outline"> = {
	DRAFT: "secondary",
	SENT: "outline",
	SIGNED: "outline",
	VOID: "secondary",
};

function StatusBadge({ status }: { status: ContractRow["status"] }) {
	return (
		<Badge
			variant={STATUS_VARIANT[status]}
			className={cn(status === "VOID" && "line-through")}
		>
			{STATUS_LABEL[status]}
		</Badge>
	);
}

function LinkedTo({ row }: { row: ContractRow }) {
	if (!row.estimate) return <EmptyCellValue />;
	return <span className="truncate">{row.estimate.title}</span>;
}

function LinkedValue({ row }: { row: ContractRow }) {
	if (!row.invoice) return <EmptyCellValue />;
	return <span className="text-muted-foreground">#{row.invoice.number}</span>;
}

export function ContractsTable({
	dealId,
	contactId,
}: {
	dealId?: string;
	contactId?: string;
} = {}) {
	return dealId || contactId ? (
		<EmbeddedContractsTable dealId={dealId} contactId={contactId} />
	) : (
		<PageContractsTable />
	);
}

function PageContractsTable() {
	const router = useRouter();
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const { query, input } = useTableQuery(contractsSearchParams);
	const status = input.status as ContractStatusFilter;

	const contracts = useQuery({
		...trpc.contracts.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = contracts.data?.rows ?? [];

	const columns: DataTableColumn<ContractRow>[] = [
		{
			id: "title",
			header: "Contract",
			sortable: true,
			hideable: false,
			width: "w-[26%]",
			cell: (row) => <span className="truncate font-medium">{row.title}</span>,
		},
		{
			id: "contact",
			header: "Contact",
			width: "w-[18%]",
			cell: (row) =>
				row.contact ? (
					<span className="truncate">{row.contact.name}</span>
				) : (
					<EmptyCellValue />
				),
		},
		{
			id: "linkedTo",
			header: "Linked to",
			width: "w-[20%]",
			hideBelow: "md",
			cell: (row) => <LinkedTo row={row} />,
		},
		{
			id: "status",
			header: "Status",
			sortable: true,
			width: "w-[12%]",
			cell: (row) => <StatusBadge status={row.status} />,
		},
		{
			id: "value",
			header: "Value",
			align: "right",
			width: "w-[12%]",
			hideBelow: "sm",
			cell: (row) => <LinkedValue row={row} />,
		},
		{
			id: "open",
			header: <span className="sr-only">Open</span>,
			label: "Open",
			hideable: false,
			align: "right",
			width: "w-[6%]",
			cell: (row) => (
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={(event) => {
						event.stopPropagation();
						router.push(workspaceUrl(`/contracts/${row.id}`));
					}}
				>
					<Icon icon={ChevronRight} />
					<span className="sr-only">Open {row.title}</span>
				</Button>
			),
		},
	];

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search contracts by title…" />}
			columns={columns}
			rows={rows}
			total={contracts.data?.total ?? 0}
			tabs={{
				id: "status",
				allLabel: "All contracts",
				options: STATUS_TABS,
			}}
			getRowId={(row) => row.id}
			loading={contracts.isFetching}
			onRowClick={(row) => router.push(workspaceUrl(`/contracts/${row.id}`))}
			empty="No contracts match this view."
		/>
	);
}

function EmbeddedContractsTable({
	dealId,
	contactId,
}: {
	dealId?: string;
	contactId?: string;
}) {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const contracts = useQuery({
		...trpc.contracts.list.queryOptions({
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

	const rows = contracts.data?.rows ?? [];

	if (contracts.isPending) {
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
						<Icon icon={DocumentSigned} />
					</EmptyMedia>
					<EmptyTitle>No contracts</EmptyTitle>
					<EmptyDescription>
						Nothing has gone out for signature on this job yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const columns: SimpleTableColumn[] = [
		{ id: "title", header: "Contract" },
		{ id: "status", header: "Status", width: "w-28" },
		{ id: "linkedTo", header: "Linked to", width: "w-40" },
		{ id: "value", header: "Value", width: "w-24", align: "right" },
		{ id: "actions", srLabel: "Open", width: "w-10" },
	];

	return (
		<SimpleTable variant="panel" columns={columns}>
			{rows.map((row) => (
				<SimpleTableRow
					key={row.id}
					clickable
					onClick={() => router.push(workspaceUrl(`/contracts/${row.id}`))}
				>
					<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
						{row.title}
					</TableCell>
					<TableCell className="py-2.5 pr-3">
						<StatusBadge status={row.status} />
					</TableCell>
					<TableCell className="truncate py-2.5 pr-3">
						<LinkedTo row={row} />
					</TableCell>
					<TableCell className="py-2.5 pr-3 text-right">
						<LinkedValue row={row} />
					</TableCell>
					<TableCell className="py-2.5 pr-3">
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={(event) => {
								event.stopPropagation();
								router.push(workspaceUrl(`/contracts/${row.id}`));
							}}
						>
							<Icon icon={ChevronRight} />
							<span className="sr-only">Open {row.title}</span>
						</Button>
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}
