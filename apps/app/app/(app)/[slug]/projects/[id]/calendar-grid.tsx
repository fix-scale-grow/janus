"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { cn } from "@crm/ui/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import type { BoardDensity } from "@/components/board/use-board-density";
import { CALENDAR } from "@/lib/calendar/calendar-config";
import { dayKey, layoutWeek } from "@/lib/calendar/span-layout";
import type { CalendarTask } from "./calendar-view";
import { TaskBar } from "./task-bar";
import { TaskPopover } from "./task-card";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
	weeks,
	scheduled,
	view,
	today,
	goalKey,
	anchorMonth,
	onDayClick,
	projectId,
	density,
}: {
	weeks: Date[][];
	scheduled: CalendarTask[];
	view: "month" | "week";
	today: string;
	goalKey: string | null;
	anchorMonth: number;
	onDayClick: (day: Date) => void;
	projectId: string;
	density?: BoardDensity;
}) {
	const maxLanes =
		view === "month" ? CALENDAR.monthMaxLanes : CALENDAR.weekMaxLanes;
	const compact = density === "compact";

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-border">
			<div className="grid grid-cols-7 border-b border-border">
				{WEEKDAY_LABELS.map((label) => (
					<div key={label} className="px-2 py-1 text-xs text-muted-foreground">
						{label}
					</div>
				))}
			</div>
			{weeks.map((week) => {
				const weekStart = week[0];
				if (!weekStart) return null;
				const { bars, overflow } = layoutWeek(scheduled, weekStart, maxLanes);
				const minHeight =
					view === "week"
						? compact
							? "16rem"
							: "20rem"
						: compact
							? "6rem"
							: "7.5rem";
				return (
					<div
						key={dayKey(weekStart)}
						data-week-row=""
						className="relative grid grid-cols-7 border-b border-border"
						style={{ minHeight }}
					>
						{week.map((day, index) => (
							<DayCell
								key={dayKey(day)}
								day={day}
								inAnchorMonth={
									view !== "month" || day.getUTCMonth() === anchorMonth
								}
								isToday={dayKey(day) === today}
								isGoal={goalKey !== null && dayKey(day) === goalKey}
								overflowCount={overflow[index] ?? 0}
								overflowTasks={scheduled.filter(
									(task) =>
										task.startDay.getTime() <= day.getTime() &&
										task.endDay.getTime() >= day.getTime(),
								)}
								projectId={projectId}
								onDayClick={onDayClick}
								density={density}
							/>
						))}
						<div
							className={cn(
								"pointer-events-none col-span-7 row-start-1 grid grid-cols-7",
								compact ? "pt-6" : "pt-7",
							)}
						>
							{bars.map((bar) => (
								<TaskBar
									key={bar.task.id}
									bar={bar}
									weekStart={weekStart}
									projectId={projectId}
									density={density}
								/>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}

function DayCell({
	day,
	inAnchorMonth,
	isToday,
	isGoal,
	overflowCount,
	overflowTasks,
	projectId,
	onDayClick,
	density,
}: {
	day: Date;
	inAnchorMonth: boolean;
	isToday: boolean;
	isGoal: boolean;
	overflowCount: number;
	overflowTasks: CalendarTask[];
	projectId: string;
	onDayClick: (day: Date) => void;
	density?: BoardDensity;
}) {
	const key = dayKey(day);
	const { setNodeRef, isOver } = useDroppable({ id: key });
	const compact = density === "compact";

	return (
		// biome-ignore lint/a11y/useSemanticElements: droppable day cell also contains a nested "+N more" button and task chips
		<div
			ref={setNodeRef}
			role="button"
			tabIndex={0}
			onClick={() => onDayClick(day)}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") onDayClick(day);
			}}
			className={cn(
				"flex cursor-pointer flex-col border-r border-border transition-colors last:border-r-0",
				compact ? "gap-0.5 p-0.5" : "gap-1 p-1",
				!inAnchorMonth && "bg-muted/30 text-muted-foreground",
				isOver && "bg-accent/60 ring-2 ring-primary/30",
			)}
		>
			<div className="flex items-center gap-1">
				<span
					className={cn(
						"flex h-5 w-5 items-center justify-center rounded-full text-xs",
						isToday && "font-medium text-primary ring-2 ring-primary",
					)}
				>
					{day.getUTCDate()}
				</span>
				{isGoal ? (
					<span className="text-primary text-xs font-medium">Goal</span>
				) : null}
			</div>
			{overflowCount > 0 ? (
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							onClick={(event) => event.stopPropagation()}
							className="mt-auto self-start text-xs text-muted-foreground hover:text-foreground"
						>
							+{overflowCount} more
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="flex flex-col gap-1"
						onClick={(event) => event.stopPropagation()}
					>
						{overflowTasks.map((task) => (
							<TaskPopover
								key={task.id}
								projectId={projectId}
								task={task}
								density={density}
							>
								<button
									type="button"
									className="truncate rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent"
								>
									{task.name}
								</button>
							</TaskPopover>
						))}
					</PopoverContent>
				</Popover>
			) : null}
		</div>
	);
}
