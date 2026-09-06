"use client";

import { DataTable, type DataTableColumn } from "@crm/ui/components/data-table";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import {
	normalizeProjectStatus,
	type ProjectStatusFilter,
	projectsSearchParams,
} from "./projects-search-params";

type ProjectRow = RouterOutputs["projects"]["list"]["rows"][number];

const STATUS_TABS: { value: ProjectStatusFilter; label: string }[] = [
	{ value: "ACTIVE", label: "Active" },
	{ value: "ON_HOLD", label: "On hold" },
	{ value: "COMPLETE", label: "Complete" },
];

export function ProjectsTable() {
	const router = useRouter();
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const { query, input } = useTableQuery(projectsSearchParams);
	const status = normalizeProjectStatus(input.status);

	const projects = useQuery({
		...trpc.projects.list.queryOptions({
			...input,
			status: status === "all" ? undefined : status,
		}),
		placeholderData: (previous) => previous,
	});

	const rows = projects.data?.rows ?? [];

	const columns: DataTableColumn<ProjectRow>[] = [
		{
			id: "name",
			header: "Name",
			sortable: true,
			hideable: false,
			width: "w-[24%]",
			cell: (row) => <span className="truncate font-medium">{row.name}</span>,
		},
		{
			id: "deal",
			header: "Deal",
			width: "w-[20%]",
			hideBelow: "md",
			cell: (row) => (
				<span className="truncate text-muted-foreground">{row.deal.name}</span>
			),
		},
		{
			id: "progress",
			header: "Progress",
			align: "right",
			width: "w-[12%]",
			cell: (row) => (
				<span className="tabular-nums">
					{row.taskCounts.done}/{row.taskCounts.total}
				</span>
			),
		},
		{
			id: "goalDate",
			header: "Goal",
			align: "right",
			width: "w-[13%]",
			hideBelow: "sm",
			cell: (row) =>
				row.goalDate ? (
					<span className="text-muted-foreground">
						<LocalDay date={row.goalDate} />
					</span>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			id: "updatedAt",
			header: "Updated",
			sortable: true,
			align: "right",
			width: "w-[13%]",
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-muted-foreground">
					<LocalRelativeTime date={row.updatedAt} />
				</span>
			),
		},
	];

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search projects by name…" />}
			columns={columns}
			rows={rows}
			total={projects.data?.total ?? 0}
			tabs={{
				id: "status",
				allLabel: "All projects",
				options: STATUS_TABS,
			}}
			getRowId={(row) => row.id}
			loading={projects.isFetching}
			onRowClick={(row) => router.push(workspaceUrl(`/projects/${row.id}`))}
			empty="No projects yet. Start one from a deal."
		/>
	);
}
