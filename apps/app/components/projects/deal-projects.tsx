"use client";

import Add from "@carbon/icons-react/es/Add";
import Task from "@carbon/icons-react/es/Task";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Icon } from "@crm/ui/components/icon";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { StartProjectDialog } from "./start-project-dialog";

type Project = RouterOutputs["projects"]["list"]["rows"][number];

const PROJECT_COLUMNS = [
	{ id: "name", header: "Name", width: "w-[36%]", className: "pl-5" },
	{
		id: "progress",
		header: "Progress",
		width: "w-[18%]",
		align: "right" as const,
	},
	{ id: "goalDate", header: "Goal date", width: "w-[24%]" },
	{ id: "status", header: "Status", width: "w-[22%]" },
];

const STATUS_LABEL: Record<Project["status"], string> = {
	ACTIVE: "Active",
	ON_HOLD: "On hold",
	COMPLETE: "Complete",
};

const STATUS_VARIANT: Record<
	Project["status"],
	"secondary" | "outline" | "default"
> = {
	ACTIVE: "outline",
	ON_HOLD: "secondary",
	COMPLETE: "default",
};

export function DealProjects({ dealId }: { dealId: string }) {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const deal = useQuery(trpc.deals.byId.queryOptions({ id: dealId }));
	const projects = useQuery(trpc.projects.list.queryOptions({ dealId }));

	const rows = projects.data?.rows ?? [];

	const trigger = (
		<Button size="sm" disabled={!deal.data}>
			<Icon icon={Add} data-icon="inline-start" />
			Start project
		</Button>
	);

	const startDialog = deal.data ? (
		<StartProjectDialog
			dealId={dealId}
			dealName={deal.data.name}
			expectedCloseDate={deal.data.expectedCloseDate}
			trigger={trigger}
		/>
	) : (
		trigger
	);

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Projects" action={startDialog}>
				{rows.length === 0 ? (
					<DetailSheetEmpty
						icon={Task}
						title="No projects yet"
						description="Start a project once this deal is ready to schedule work."
					/>
				) : (
					<SimpleTable variant="panel" columns={PROJECT_COLUMNS}>
						{rows.map((project) => (
							<SimpleTableRow
								key={project.id}
								clickable
								onClick={() =>
									router.push(workspaceUrl(`/projects/${project.id}`))
								}
							>
								<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
									{project.name}
								</TableCell>
								<TableCell className="truncate px-3 py-2.5 text-right tabular-nums text-muted-foreground">
									{project.taskCounts.done}/{project.taskCounts.total}
								</TableCell>
								<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
									{project.goalDate ? (
										<LocalDay date={project.goalDate} />
									) : (
										<EmptyCellValue />
									)}
								</TableCell>
								<TableCell className="px-3 py-2.5">
									<Badge variant={STATUS_VARIANT[project.status]}>
										{STATUS_LABEL[project.status]}
									</Badge>
								</TableCell>
							</SimpleTableRow>
						))}
					</SimpleTable>
				)}
			</DetailSheetSection>
		</DetailSheetBody>
	);
}
