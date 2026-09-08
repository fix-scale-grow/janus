"use client";

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
import { Button } from "@crm/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { cn } from "@crm/ui/lib/utils";
import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { NO_CREW_CLASSES } from "@/components/crews/crew-colors";
import { CALENDAR } from "@/lib/calendar/calendar-config";
import {
	addDays,
	dayKey,
	fromDayKey,
	layoutWeek,
	monthWeeks,
	type WeekBar,
	weekOf,
} from "@/lib/calendar/span-layout";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import {
	normalizeProjectStatus,
	type ProjectStatusFilter,
} from "./projects-search-params";

type CalendarRow = RouterOutputs["projects"]["calendarRange"][number];

type ProjectSpan = {
	id: string;
	name: string;
	status: CalendarRow["status"];
	dealName: string;
	goalDate: Date | null;
	startDay: Date;
	endDay: Date;
	sortOrder: number;
};

type PendingMove = {
	span: ProjectSpan;
	deltaDays: number;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_TABS: { value: ProjectStatusFilter; label: string }[] = [
	{ value: "all", label: "All projects" },
	{ value: "ACTIVE", label: "Active" },
	{ value: "ON_HOLD", label: "On hold" },
	{ value: "COMPLETE", label: "Complete" },
];

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

const WEEK_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

const DATE_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

const BAR_CLASSES =
	"pointer-events-auto flex h-6 items-center gap-1 truncate rounded-sm border px-1.5 text-left text-xs touch-none select-none";

function todayUtc(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function ProjectsCalendar({ viewToggle }: { viewToggle: ReactNode }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [view, setView] = useState<"month" | "week">("month");
	const [anchor, setAnchor] = useState<Date>(() => todayUtc());
	const [activeId, setActiveId] = useState<string | null>(null);
	const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
	const suppressClick = useRef(false);
	const [statusParam, setStatusParam] = useQueryState(
		"status",
		parseAsString.withDefault("all"),
	);
	const status = normalizeProjectStatus(statusParam);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const weeks = useMemo(
		() => (view === "month" ? monthWeeks(anchor) : [weekOf(anchor)]),
		[view, anchor],
	);

	const from = weeks[0]?.[0] ?? anchor;
	const to = addDays(weeks[weeks.length - 1]?.[0] ?? anchor, 6);

	const projects = useQuery({
		...trpc.projects.calendarRange.queryOptions({
			from,
			to,
			status: status === "all" ? undefined : status,
		}),
		placeholderData: (previous) => previous,
	});

	const projectUpdate = useMutation(
		trpc.projects.update.mutationOptions({
			onSuccess: (updated) => void cache.project(updated.id),
			onError: (error) => toast.error(error.message),
		}),
	);

	const spans = useMemo<ProjectSpan[]>(
		() =>
			(projects.data ?? []).map((row) => ({
				id: row.id,
				name: row.name,
				status: row.status,
				dealName: row.deal.name,
				goalDate: row.goalDate ? new Date(row.goalDate) : null,
				startDay: new Date(row.startDate),
				endDay: new Date(row.endDate),
				sortOrder: 0,
			})),
		[projects.data],
	);

	const today = useMemo(() => todayUtc(), []);
	const todayKey = dayKey(today);

	const activeSpan =
		activeId != null
			? (spans.find((span) => span.id === activeId) ?? null)
			: null;

	const rangeLabel =
		view === "month"
			? MONTH_LABEL.format(anchor)
			: `${WEEK_LABEL.format(weeks[0]?.[0] ?? anchor)} – ${WEEK_LABEL.format(weeks[0]?.[6] ?? anchor)}`;

	function shift(direction: 1 | -1) {
		if (view === "month") {
			setAnchor(
				(current) =>
					new Date(
						Date.UTC(
							current.getUTCFullYear(),
							current.getUTCMonth() + direction,
							1,
						),
					),
			);
			return;
		}
		setAnchor((current) => addDays(current, 7 * direction));
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
		suppressClick.current = true;
		setTimeout(() => {
			suppressClick.current = false;
		}, 0);
		const overId = event.over?.id;
		if (overId == null) return;
		const targetKey = String(overId);
		const startKey = event.active.data.current?.startKey as string | undefined;
		if (!startKey || startKey === targetKey) return;

		const deltaDays = Math.round(
			(fromDayKey(targetKey).getTime() - fromDayKey(startKey).getTime()) /
				86_400_000,
		);
		if (deltaDays === 0) return;

		const span = spans.find((row) => row.id === String(event.active.id));
		if (!span) return;

		setPendingMove({ span, deltaDays });
	}

	function confirmMove() {
		if (!pendingMove) return;
		const { span, deltaDays } = pendingMove;
		projectUpdate.mutate({
			id: span.id,
			startDate: addDays(span.startDay, deltaDays),
			...(span.goalDate ? { goalDate: addDays(span.goalDate, deltaDays) } : {}),
		});
		setPendingMove(null);
	}

	const maxLanes =
		view === "month" ? CALENDAR.monthMaxLanes : CALENDAR.weekMaxLanes;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Tabs
					value={status}
					onValueChange={(next) =>
						void setStatusParam(next === "all" ? null : next)
					}
				>
					<TabsList variant="line">
						{STATUS_TABS.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<div className="ml-auto flex items-center gap-2">
					<ToggleGroup
						type="single"
						value={view}
						onValueChange={(next) => next && setView(next as typeof view)}
					>
						<ToggleGroupItem value="month">Month</ToggleGroupItem>
						<ToggleGroupItem value="week">Week</ToggleGroupItem>
					</ToggleGroup>
					<Button variant="outline" size="sm" onClick={() => shift(-1)}>
						‹
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setAnchor(todayUtc())}
					>
						Today
					</Button>
					<Button variant="outline" size="sm" onClick={() => shift(1)}>
						›
					</Button>
					<span className="text-sm font-medium">{rangeLabel}</span>
					{viewToggle}
				</div>
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCorners}
				onDragStart={(event: DragStartEvent) => {
					suppressClick.current = false;
					setActiveId(String(event.active.id));
				}}
				onDragEnd={handleDragEnd}
				onDragCancel={() => setActiveId(null)}
			>
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-border">
					<div className="grid grid-cols-7 border-b border-border">
						{WEEKDAY_LABELS.map((label) => (
							<div
								key={label}
								className="px-2 py-1 text-xs text-muted-foreground"
							>
								{label}
							</div>
						))}
					</div>
					{weeks.map((week) => {
						const weekStart = week[0];
						if (!weekStart) return null;
						const { bars, overflow } = layoutWeek(spans, weekStart, maxLanes);
						return (
							<div
								key={dayKey(weekStart)}
								className="relative grid grid-cols-7 border-b border-border"
								style={{ minHeight: view === "week" ? "20rem" : "7.5rem" }}
							>
								{week.map((day, index) => (
									<DayCell
										key={dayKey(day)}
										day={day}
										column={index + 1}
										inAnchorMonth={
											view !== "month" ||
											day.getUTCMonth() === anchor.getUTCMonth()
										}
										isToday={dayKey(day) === todayKey}
										overflowCount={overflow[index] ?? 0}
										overflowProjects={spans.filter(
											(span) =>
												span.startDay.getTime() <= day.getTime() &&
												span.endDay.getTime() >= day.getTime(),
										)}
									/>
								))}
								<div className="pointer-events-none col-span-7 col-start-1 row-start-1 grid grid-cols-7 pt-7">
									{bars.map((bar) => (
										<ProjectBar
											key={bar.task.id}
											bar={bar}
											suppressClick={suppressClick}
										/>
									))}
								</div>
							</div>
						);
					})}
				</div>
				<DragOverlay dropAnimation={null}>
					{activeSpan ? (
						<div className={cn(BAR_CLASSES, NO_CREW_CLASSES.bar)}>
							{projectLabel(activeSpan)}
						</div>
					) : null}
				</DragOverlay>
			</DndContext>

			{!projects.isPending && spans.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No projects in this range. Start one from a deal.
				</p>
			) : null}

			<AlertDialog
				open={pendingMove !== null}
				onOpenChange={(open) => {
					if (!open) setPendingMove(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Move {pendingMove?.span.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingMove ? moveSummary(pendingMove) : null}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmMove}>
							Move project
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function moveSummary({ span, deltaDays }: PendingMove): string {
	const startLine = `Start moves from ${DATE_LABEL.format(span.startDay)} to ${DATE_LABEL.format(addDays(span.startDay, deltaDays))}.`;
	if (span.goalDate) {
		return `${startLine} Goal moves from ${DATE_LABEL.format(span.goalDate)} to ${DATE_LABEL.format(addDays(span.goalDate, deltaDays))}.`;
	}
	return `${startLine} Scheduled tasks stay where they are.`;
}

function projectLabel(span: ProjectSpan): string {
	if (span.status === "COMPLETE") return `✓ ${span.name}`;
	if (span.status === "ON_HOLD") return `${span.name} · On hold`;
	return span.name;
}

function ProjectBar({
	bar,
	suppressClick,
}: {
	bar: WeekBar<ProjectSpan>;
	suppressClick: { current: boolean };
}) {
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const span = bar.task;
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id: span.id,
			data: { startKey: dayKey(span.startDay) },
		});

	return (
		<button
			ref={setNodeRef}
			type="button"
			onClick={() => {
				if (suppressClick.current) {
					suppressClick.current = false;
					return;
				}
				router.push(workspaceUrl(`/projects/${span.id}`));
			}}
			title={`${span.name} — ${span.dealName}`}
			style={{
				gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
				marginTop: `${bar.lane * 1.75}rem`,
				transform: CSS.Translate.toString(transform),
			}}
			className={cn(
				BAR_CLASSES,
				NO_CREW_CLASSES.bar,
				"cursor-pointer hover:bg-accent",
				span.status === "COMPLETE" && "opacity-60",
				bar.clippedStart && "rounded-l-none border-l-0",
				bar.clippedEnd && "rounded-r-none border-r-0",
				isDragging && "opacity-40",
			)}
			{...attributes}
			{...listeners}
		>
			<span className="truncate">{projectLabel(span)}</span>
		</button>
	);
}

function DayCell({
	day,
	column,
	inAnchorMonth,
	isToday,
	overflowCount,
	overflowProjects,
}: {
	day: Date;
	column: number;
	inAnchorMonth: boolean;
	isToday: boolean;
	overflowCount: number;
	overflowProjects: ProjectSpan[];
}) {
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const key = dayKey(day);
	const { setNodeRef, isOver } = useDroppable({ id: key });

	return (
		<div
			ref={setNodeRef}
			style={{ gridColumn: column }}
			className={cn(
				"row-start-1 flex flex-col gap-1 border-r border-border p-1 transition-colors last:border-r-0",
				!inAnchorMonth && "bg-muted/30 text-muted-foreground",
				isOver && "bg-accent/60 ring-2 ring-primary/30",
			)}
		>
			<span
				className={cn(
					"flex h-5 w-5 items-center justify-center rounded-full text-xs",
					isToday && "font-medium text-primary ring-2 ring-primary",
				)}
			>
				{day.getUTCDate()}
			</span>
			{overflowCount > 0 ? (
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="mt-auto self-start text-xs text-muted-foreground hover:text-foreground"
						>
							+{overflowCount} more
						</button>
					</PopoverTrigger>
					<PopoverContent align="start" className="flex flex-col gap-1">
						{overflowProjects.map((span) => (
							<button
								key={span.id}
								type="button"
								onClick={() =>
									router.push(workspaceUrl(`/projects/${span.id}`))
								}
								className="truncate rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent"
							>
								{projectLabel(span)}
							</button>
						))}
					</PopoverContent>
				</Popover>
			) : null}
		</div>
	);
}
