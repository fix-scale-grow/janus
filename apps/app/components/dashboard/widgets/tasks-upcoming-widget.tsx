"use client";

import { CardPanel, CardPanelEmpty } from "@crm/ui/components/card";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { TableCell } from "@crm/ui/components/table";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { WidgetBoundary } from "@/components/dashboard/summary-context";
import {
	WIDGET_CELL as CELL,
	WIDGET_TABLE_GUTTER,
} from "@/components/dashboard/widgets/widget-table";
import { LocalDay } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "task", header: "Task" },
	{
		id: "crew",
		header: "Crew",
		width: "w-32",
		className: "hidden sm:table-cell",
	},
	{ id: "when", header: "When", width: "w-24", align: "right" },
];

type UpcomingTask = RouterOutputs["projects"]["upcomingTasks"]["tasks"][number];

export function TasksUpcomingWidget() {
	const trpc = useTRPC();
	const query = useQuery(trpc.projects.upcomingTasks.queryOptions());

	return (
		<WidgetShell
			title="Upcoming tasks"
			description="What's on the schedule in the next two weeks"
		>
			<WidgetBoundary onRetry={() => query.refetch()}>
				{query.data ? (
					<TasksUpcomingBody tasks={query.data.tasks} />
				) : query.isError ? (
					<WidgetError onRetry={() => query.refetch()} />
				) : (
					<div className="flex flex-1 items-center justify-center py-12">
						<Spinner />
					</div>
				)}
			</WidgetBoundary>
		</WidgetShell>
	);
}

function TasksUpcomingBody({ tasks }: { tasks: UpcomingTask[] }) {
	const workspaceUrl = useWorkspaceUrl();

	if (tasks.length === 0) {
		return <CardPanelEmpty>Nothing scheduled. Enjoy it.</CardPanelEmpty>;
	}

	return (
		<CardPanel>
			<SimpleTable
				variant="panel"
				surface="page"
				columns={COLUMNS}
				className={WIDGET_TABLE_GUTTER}
			>
				{tasks.map((task) => (
					<SimpleTableRow key={task.id}>
						<TableCell className={CELL}>
							<span className="flex min-w-0 flex-col">
								<Link
									href={workspaceUrl(`/projects/${task.project.id}`)}
									className="truncate font-medium hover:underline"
								>
									{task.name}
								</Link>
								{task.dealName ? (
									task.dealId ? (
										<RecordLink kind="deal" id={task.dealId}>
											{task.dealName}
										</RecordLink>
									) : (
										<span className="truncate text-muted-foreground">
											{task.dealName}
										</span>
									)
								) : null}
							</span>
						</TableCell>
						<TableCell className={`${CELL} hidden sm:table-cell`}>
							{task.crewName ?? <EmptyCellValue />}
						</TableCell>
						<TableCell className={`${CELL} text-right tabular-nums`}>
							{task.startDay ? (
								<LocalDay date={task.startDay} />
							) : (
								<EmptyCellValue />
							)}
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
		</CardPanel>
	);
}
