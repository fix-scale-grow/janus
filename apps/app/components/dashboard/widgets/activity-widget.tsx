"use client";

import { CardTableEmpty } from "@crm/ui/components/card-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { WidgetError, WidgetShell } from "@crm/ui/components/widget-shell";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import {
	type Summary,
	SummarySpinnerRow,
	useSummary,
	WidgetBoundary,
} from "@/components/dashboard/summary-context";
import { LocalRelativeTime } from "@/components/local-date-time";
import { activityLabel } from "@/lib/activity-presentation";

const CELL = "px-3 py-2.5 align-middle";

const ACTIVITY_COLUMNS: SimpleTableColumn[] = [
	{ id: "activity", header: "Activity" },
	{
		id: "deal",
		header: "Deal",
		width: "w-48",
		className: "hidden lg:table-cell",
	},
	{
		id: "who",
		header: "Who",
		width: "w-32",
		className: "hidden md:table-cell",
	},
	{ id: "when", header: "When", width: "w-20", align: "right" },
];

type ActivityEntry = Summary["recentActivity"][number];

export function ActivityWidget() {
	const { summary, scope, isError, refetchSummary } = useSummary();
	const mine = scope === "me";

	return (
		<WidgetShell
			title={mine ? "Your recent activity" : "Recent activity"}
			description={
				mine
					? "Every note, task and stage change you have logged"
					: "Every note, task and stage change across the workspace"
			}
		>
			<WidgetBoundary onRetry={refetchSummary}>
				{summary ? (
					<ActivityBody recentActivity={summary.recentActivity} />
				) : isError ? (
					<WidgetError onRetry={refetchSummary} />
				) : (
					<SummarySpinnerRow />
				)}
			</WidgetBoundary>
		</WidgetShell>
	);
}

function ActivityBody({ recentActivity }: { recentActivity: ActivityEntry[] }) {
	if (recentActivity.length === 0) {
		return <CardTableEmpty>Nothing has happened yet.</CardTableEmpty>;
	}

	return (
		<SimpleTable columns={ACTIVITY_COLUMNS}>
			{recentActivity.map((entry) => (
				<SimpleTableRow key={entry.id}>
					<TableCell className={CELL}>
						<span className="truncate">
							{entry.subject ?? activityLabel(entry.type)}
						</span>
					</TableCell>
					<TableCell className={`${CELL} hidden lg:table-cell`}>
						{entry.deal ? (
							<RecordLink kind="deal" id={entry.deal.id}>
								{entry.deal.name}
							</RecordLink>
						) : (
							<EmptyCellValue />
						)}
					</TableCell>
					<TableCell
						className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
					>
						{entry.createdBy.name}
					</TableCell>
					<TableCell className={`${CELL} text-right text-muted-foreground`}>
						<LocalRelativeTime date={entry.createdAt} />
					</TableCell>
				</SimpleTableRow>
			))}
		</SimpleTable>
	);
}
