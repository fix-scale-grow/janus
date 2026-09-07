"use client";

import { Badge } from "@crm/ui/components/badge";
import { cn } from "@crm/ui/lib/utils";
import { useMemo } from "react";
import { usePanScroll } from "@/components/board/use-pan-scroll";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { CALENDAR } from "@/lib/calendar/calendar-config";
import { addDays, dayKey, weekOf } from "@/lib/calendar/span-layout";
import type { CalendarTask, Project } from "./calendar-view";
import { barClasses, TASK_BAR_CLASSES } from "./task-bar";
import {
	STATUS_FLOW,
	STATUS_LABEL,
	STATUS_VARIANT,
	TaskPopover,
	useCycleTaskStatus,
} from "./task-card";

const DAY_MS = 86_400_000;
const DAY_WIDTH_REM = 2.5;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SHORT_DATE_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

function todayUtc(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function TimelineView({
	project,
	anchor,
}: {
	project: Project;
	anchor: Date;
}) {
	const { ref, handlers } = usePanScroll<HTMLDivElement>();

	const windowStart = useMemo(() => weekOf(anchor)[0] ?? anchor, [anchor]);
	const days = useMemo(
		() =>
			Array.from({ length: CALENDAR.timelineDays }, (_, index) =>
				addDays(windowStart, index),
			),
		[windowStart],
	);
	const windowEnd = days[days.length - 1] ?? windowStart;
	const trackWidthRem = days.length * DAY_WIDTH_REM;

	const today = useMemo(() => todayUtc(), []);
	const todayKey = dayKey(today);

	const rows = useMemo<CalendarTask[]>(
		() =>
			project.tasks
				.filter(
					(task): task is typeof task & { startDay: string; endDay: string } =>
						task.startDay != null && task.endDay != null,
				)
				.map((task) => ({
					...task,
					startDay: new Date(task.startDay),
					endDay: new Date(task.endDay),
				}))
				.sort((a, b) => a.startDay.getTime() - b.startDay.getTime()),
		[project.tasks],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-border">
			<div
				ref={ref}
				{...handlers}
				className="cursor-grab overflow-x-auto active:cursor-grabbing"
			>
				<div className="sticky top-0 z-20 flex bg-background">
					<div className="sticky left-0 z-30 w-56 shrink-0 border-r border-b border-border bg-background" />
					<div className="flex">
						{days.map((day) => {
							const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
							const isToday = dayKey(day) === todayKey;
							return (
								<div
									key={dayKey(day)}
									className={cn(
										"w-10 shrink-0 border-r border-b border-border px-1 py-1 text-center text-xs text-muted-foreground last:border-r-0",
										isWeekend && "bg-muted/40",
										isToday && "ring-2 ring-primary ring-inset",
									)}
								>
									<div>{WEEKDAY_LABELS[day.getUTCDay()]}</div>
									<div className="font-medium text-foreground">
										{day.getUTCDate()}
									</div>
								</div>
							);
						})}
					</div>
				</div>
				{rows.map((task) => (
					<TimelineRow
						key={task.id}
						task={task}
						projectId={project.id}
						windowStart={windowStart}
						windowEnd={windowEnd}
						trackWidthRem={trackWidthRem}
					/>
				))}
			</div>
		</div>
	);
}

function TimelineRow({
	task,
	projectId,
	windowStart,
	windowEnd,
	trackWidthRem,
}: {
	task: CalendarTask;
	projectId: string;
	windowStart: Date;
	windowEnd: Date;
	trackWidthRem: number;
}) {
	const cycleStatus = useCycleTaskStatus(projectId);
	const colors = task.crew
		? (CREW_COLOR_CLASSES[task.crew.color] ?? NO_CREW_CLASSES)
		: NO_CREW_CLASSES;

	const outside =
		task.endDay.getTime() < windowStart.getTime() ||
		task.startDay.getTime() > windowEnd.getTime();

	const rangeLabel = outside
		? task.startDay.getTime() > windowEnd.getTime()
			? `→ ${SHORT_DATE_LABEL.format(task.startDay)}`
			: `← ${SHORT_DATE_LABEL.format(task.endDay)}`
		: null;

	const clampedStart =
		task.startDay.getTime() < windowStart.getTime()
			? windowStart
			: task.startDay;
	const clampedEnd =
		task.endDay.getTime() > windowEnd.getTime() ? windowEnd : task.endDay;
	const offsetDays = Math.round(
		(clampedStart.getTime() - windowStart.getTime()) / DAY_MS,
	);
	const spanDays = Math.max(
		1,
		Math.round((clampedEnd.getTime() - clampedStart.getTime()) / DAY_MS) + 1,
	);

	return (
		<div className="flex border-b border-border last:border-b-0">
			<div className="sticky left-0 z-10 flex w-56 shrink-0 items-center gap-1.5 border-r border-border bg-background px-2 py-1.5 text-xs">
				<span className={cn("size-2 shrink-0 rounded-full", colors.dot)} />
				<span className="flex-1 truncate text-sm text-foreground">
					{task.name}
				</span>
				{rangeLabel ? (
					<span className="shrink-0 text-muted-foreground">{rangeLabel}</span>
				) : null}
				<button
					type="button"
					onClick={() =>
						cycleStatus.mutate({
							id: task.id,
							status: STATUS_FLOW[task.status],
						})
					}
					disabled={cycleStatus.isPending}
					className="shrink-0"
				>
					<Badge variant={STATUS_VARIANT[task.status]}>
						{STATUS_LABEL[task.status]}
					</Badge>
				</button>
			</div>
			<div
				className="relative"
				style={{ width: `${trackWidthRem}rem`, height: "2.25rem" }}
			>
				{outside ? null : (
					<TaskPopover projectId={projectId} task={task}>
						<button
							type="button"
							style={{
								left: `${offsetDays * DAY_WIDTH_REM}rem`,
								width: `${spanDays * DAY_WIDTH_REM}rem`,
							}}
							className={cn(
								TASK_BAR_CLASSES,
								barClasses(task),
								"absolute top-1/2 -translate-y-1/2",
							)}
						>
							{task.name}
						</button>
					</TaskPopover>
				)}
			</div>
		</div>
	);
}
