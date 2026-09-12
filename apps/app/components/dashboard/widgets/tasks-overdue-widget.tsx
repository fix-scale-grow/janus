"use client";

import { CardPanel, CardPanelEmpty } from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import {
	type Summary,
	SummarySpinnerRow,
	useSummary,
	WidgetBoundary,
} from "@/components/dashboard/summary-context";
import {
	WIDGET_CELL as CELL,
	WIDGET_TABLE_GUTTER,
} from "@/components/dashboard/widgets/widget-table";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const TASK_COLUMNS: SimpleTableColumn[] = [
	{ id: "done", srLabel: "Done", width: "w-8" },
	{ id: "task", header: "Task" },
	{ id: "overdue", header: "Overdue", width: "w-24", align: "right" },
];

type OverdueTask = Summary["overdueTasks"][number];

export function TasksOverdueWidget() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { summary, isError, refetchSummary } = useSummary();

	const complete = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => cache.activity(),
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<WidgetShell
			title="Overdue tasks"
			description={
				summary
					? summary.overdueTasks.length === 0
						? "Every task you have logged is either done or still to come"
						: `${formatCount(summary.overdueTasks.length, "task")} past due`
					: undefined
			}
		>
			<WidgetBoundary onRetry={refetchSummary}>
				{summary ? (
					<TasksOverdueBody
						tasks={summary.overdueTasks}
						completePending={complete.isPending}
						onComplete={(id) => complete.mutate({ id, completed: true })}
					/>
				) : isError ? (
					<WidgetError onRetry={refetchSummary} />
				) : (
					<SummarySpinnerRow />
				)}
			</WidgetBoundary>
		</WidgetShell>
	);
}

function TasksOverdueBody({
	tasks,
	completePending,
	onComplete,
}: {
	tasks: OverdueTask[];
	completePending: boolean;
	onComplete: (id: string) => void;
}) {
	if (tasks.length === 0) {
		return <CardPanelEmpty>Nothing overdue. Good.</CardPanelEmpty>;
	}

	return (
		<CardPanel>
			<SimpleTable
				variant="panel"
				surface="page"
				columns={TASK_COLUMNS}
				className={WIDGET_TABLE_GUTTER}
			>
				{tasks.map((task) => (
					<SimpleTableRow key={task.id}>
						<TableCell className={CELL}>
							<Checkbox
								checked={false}
								disabled={completePending}
								aria-label="Mark as done"
								onCheckedChange={() => onComplete(task.id)}
							/>
						</TableCell>
						<TableCell className={CELL}>
							<span className="flex min-w-0 flex-col">
								<span className="truncate">{task.subject}</span>
								<span className="flex min-w-0 text-muted-foreground">
									{task.deal ? (
										<RecordLink kind="deal" id={task.deal.id}>
											{task.deal.name}
										</RecordLink>
									) : null}
								</span>
							</span>
						</TableCell>
						<TableCell className={`${CELL} text-right`}>
							<StatusIndicator
								tone="error"
								label={
									task.dueAt ? (
										<LocalRelativeTime date={task.dueAt} />
									) : (
										"No due date"
									)
								}
							/>
						</TableCell>
					</SimpleTableRow>
				))}
			</SimpleTable>
		</CardPanel>
	);
}
