"use client";

import { Button } from "@crm/ui/components/button";
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
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BoardDensityToggle } from "@/components/board/board-density-toggle";
import {
	type BoardDensity,
	useBoardDensity,
} from "@/components/board/use-board-density";
import { CALENDAR } from "@/lib/calendar/calendar-config";
import {
	addDays,
	dayKey,
	fromDayKey,
	monthWeeks,
	weekOf,
} from "@/lib/calendar/span-layout";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { AddTaskPanel } from "./add-task-panel";
import { CalendarGrid } from "./calendar-grid";
import { barClasses, TASK_BAR_CLASSES } from "./task-bar";
import { TimelineView } from "./timeline-view";
import { UnscheduledStrip } from "./unscheduled-strip";

export type Project = RouterOutputs["projects"]["byId"];
export type ProjectTask = Project["tasks"][number];
export type CalendarTask = Omit<ProjectTask, "startDay" | "endDay"> & {
	startDay: Date;
	endDay: Date;
};

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

function todayUtc(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function moveTask(
	data: Project | undefined,
	id: string,
	startDay: Date | null,
	endDay: Date | null,
	sortOrder: number,
): Project | undefined {
	if (!data) return data;
	const startIso = startDay ? startDay.toISOString() : null;
	const endIso = endDay ? endDay.toISOString() : null;
	let changed = false;
	const tasks = data.tasks.map((task) => {
		if (
			task.id === id &&
			(task.startDay !== startIso ||
				task.endDay !== endIso ||
				task.sortOrder !== sortOrder)
		) {
			changed = true;
			return { ...task, startDay: startIso, endDay: endIso, sortOrder };
		}
		return task;
	});
	return changed ? { ...data, tasks } : data;
}

export function CalendarView({
	id,
	boardDensity,
}: {
	id: string;
	boardDensity?: BoardDensity;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();
	const [tab, setTab] = useState<"calendar" | "timeline">("calendar");
	const [view, setView] = useState<"month" | "week">("month");
	const [anchor, setAnchor] = useState<Date>(() => todayUtc());
	const [activeId, setActiveId] = useState<string | null>(null);
	const [panelOpen, setPanelOpen] = useState(false);
	const [panelDefaultDay, setPanelDefaultDay] = useState<string | null>(null);
	const { density, setDensity } = useBoardDensity(
		"project-board",
		boardDensity,
	);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const project = useQuery(trpc.projects.byId.queryOptions({ id }));
	useQuery(trpc.crews.list.queryOptions());

	const taskMove = useMutation(
		trpc.projects.taskMove.mutationOptions({
			onMutate: async ({ id: taskId, startDay, endDay, sortOrder }) => {
				const key = trpc.projects.byId.queryKey({ id });
				await queryClient.cancelQueries({ queryKey: key });
				const previous = queryClient.getQueryData<Project>(key);
				queryClient.setQueryData<Project>(key, (data) =>
					moveTask(
						data,
						taskId,
						startDay as Date | null,
						endDay as Date | null,
						sortOrder,
					),
				);
				return { previous };
			},
			onError: (error, _variables, context) => {
				if (context?.previous) {
					queryClient.setQueryData(
						trpc.projects.byId.queryKey({ id }),
						context.previous,
					);
				}
				toast.error(error.message);
			},
			onSettled: () => void cache.project(id),
		}),
	);

	const tasks = project.data?.tasks ?? [];

	const scheduled = useMemo<CalendarTask[]>(
		() =>
			tasks
				.filter(
					(task): task is typeof task & { startDay: string; endDay: string } =>
						task.startDay != null && task.endDay != null,
				)
				.map((task) => ({
					...task,
					startDay: new Date(task.startDay),
					endDay: new Date(task.endDay),
				})),
		[tasks],
	);

	const unscheduled = useMemo(
		() => tasks.filter((task) => !task.startDay),
		[tasks],
	);

	const today = useMemo(() => todayUtc(), []);
	const todayKey = dayKey(today);
	const goalKey = project.data?.goalDate
		? dayKey(new Date(project.data.goalDate))
		: null;

	const weeks = useMemo(
		() =>
			tab === "calendar" && view === "month"
				? monthWeeks(anchor)
				: [weekOf(anchor)],
		[tab, view, anchor],
	);

	const activeTask =
		activeId != null
			? (scheduled.find((task) => task.id === activeId) ?? null)
			: null;

	const timelineStart = useMemo(() => weekOf(anchor)[0] ?? anchor, [anchor]);
	const timelineEnd = useMemo(
		() => addDays(timelineStart, CALENDAR.timelineDays - 1),
		[timelineStart],
	);

	const rangeLabel =
		tab === "timeline"
			? `${WEEK_LABEL.format(timelineStart)} – ${WEEK_LABEL.format(timelineEnd)}`
			: view === "month"
				? MONTH_LABEL.format(anchor)
				: `${WEEK_LABEL.format(weeks[0]?.[0] ?? anchor)} – ${WEEK_LABEL.format(weeks[0]?.[6] ?? anchor)}`;

	function shift(direction: 1 | -1) {
		if (tab === "calendar" && view === "month") {
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

	function goToday() {
		setAnchor(todayUtc());
	}

	function openPanel(day: Date | null) {
		setPanelDefaultDay(day ? dayKey(day) : null);
		setPanelOpen(true);
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
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

		const taskId = String(event.active.id);
		const task = scheduled.find((row) => row.id === taskId);
		if (!task) return;

		taskMove.mutate({
			id: taskId,
			startDay: addDays(task.startDay, deltaDays),
			endDay: addDays(task.endDay, deltaDays),
			sortOrder: 0,
		});
	}

	if (!project.data) return null;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex items-center gap-2">
				<Tabs value={tab} onValueChange={(next) => setTab(next as typeof tab)}>
					<TabsList variant="line">
						<TabsTrigger value="calendar">Calendar</TabsTrigger>
						<TabsTrigger value="timeline">Timeline</TabsTrigger>
					</TabsList>
				</Tabs>
				{tab === "calendar" ? (
					<ToggleGroup
						type="single"
						value={view}
						onValueChange={(next) => next && setView(next as typeof view)}
					>
						<ToggleGroupItem value="month">Month</ToggleGroupItem>
						<ToggleGroupItem value="week">Week</ToggleGroupItem>
					</ToggleGroup>
				) : null}
				<div className="ml-auto flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => shift(-1)}>
						‹
					</Button>
					<Button variant="outline" size="sm" onClick={goToday}>
						Today
					</Button>
					<Button variant="outline" size="sm" onClick={() => shift(1)}>
						›
					</Button>
					<span className="text-sm font-medium">{rangeLabel}</span>
					<Button size="sm" onClick={() => openPanel(null)}>
						Add task
					</Button>
					<BoardDensityToggle density={density} onDensityChange={setDensity} />
				</div>
			</div>

			{tab === "calendar" ? (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCorners}
					onDragStart={(event: DragStartEvent) =>
						setActiveId(String(event.active.id))
					}
					onDragEnd={handleDragEnd}
					onDragCancel={() => setActiveId(null)}
				>
					<CalendarGrid
						weeks={weeks}
						scheduled={scheduled}
						view={view}
						today={todayKey}
						goalKey={goalKey}
						anchorMonth={anchor.getUTCMonth()}
						onDayClick={openPanel}
						projectId={id}
						density={density}
					/>
					<DragOverlay dropAnimation={null}>
						{activeTask ? (
							<div className={cn(TASK_BAR_CLASSES, barClasses(activeTask))}>
								{activeTask.name}
							</div>
						) : null}
					</DragOverlay>
				</DndContext>
			) : (
				<TimelineView
					project={project.data}
					anchor={anchor}
					density={density}
				/>
			)}

			<UnscheduledStrip projectId={id} tasks={unscheduled} density={density} />

			<AddTaskPanel
				projectId={id}
				open={panelOpen}
				onOpenChange={setPanelOpen}
				defaultStartDay={panelDefaultDay}
			/>
		</div>
	);
}
