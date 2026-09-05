"use client";

import { cn } from "@crm/ui/lib/utils";
import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePanScroll } from "@/components/board/use-pan-scroll";
import { LocalDay } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { AddTaskInput } from "./add-task-input";
import { BOARD } from "./board-config";
import { dayKey, dayRange } from "./day-range";
import { type ProjectTask, TaskCard, TaskCardBody } from "./task-card";

type Project = RouterOutputs["projects"]["byId"];

const HEADER_DAY_OPTIONS: Intl.DateTimeFormatOptions = {
	weekday: "short",
	month: "short",
	day: "numeric",
};

function moveTask(
	data: Project | undefined,
	id: string,
	day: Date | null,
	sortOrder: number,
): Project | undefined {
	if (!data) return data;
	const dayIso = day ? day.toISOString() : null;
	let changed = false;
	const tasks = data.tasks.map((task) => {
		if (
			task.id === id &&
			(task.day !== dayIso || task.sortOrder !== sortOrder)
		) {
			changed = true;
			return { ...task, day: dayIso, sortOrder };
		}
		return task;
	});
	return changed ? { ...data, tasks } : data;
}

export function ProjectBoard({ id }: { id: string }) {
	const { ref: panRef, handlers: panHandlers } = usePanScroll<HTMLDivElement>();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();
	const [activeId, setActiveId] = useState<string | null>(null);
	const todayColumnRef = useRef<HTMLDivElement | null>(null);
	const scrolledToToday = useRef(false);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const query = useQuery(trpc.projects.byId.queryOptions({ id }));
	const project = query.data;

	const taskMove = useMutation(
		trpc.projects.taskMove.mutationOptions({
			onMutate: async ({ id: taskId, day, sortOrder }) => {
				const key = trpc.projects.byId.queryKey({ id });
				await queryClient.cancelQueries({ queryKey: key });
				const previous = queryClient.getQueryData<Project>(key);
				queryClient.setQueryData<Project>(key, (data) =>
					moveTask(data, taskId, day as Date | null, sortOrder),
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

	const today = useMemo(() => {
		const now = new Date();
		return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
	}, []);

	const columns = useMemo<(Date | null)[]>(() => {
		if (!project) return [null];
		const startDate = new Date(project.startDate);
		const goalDate = project.goalDate ? new Date(project.goalDate) : null;
		const taskDays = project.tasks
			.filter(
				(task): task is ProjectTask & { day: string } => task.day !== null,
			)
			.map((task) => new Date(task.day));

		const days = dayRange({
			startDate,
			goalDate,
			taskDays,
			today,
			max: BOARD.maxDayColumns,
		});

		return [null, ...days];
	}, [project, today]);

	const byColumn = useMemo(() => {
		const map = new Map<string, ProjectTask[]>();
		for (const column of columns) map.set(dayKey(column), []);
		for (const task of project?.tasks ?? []) {
			const key = dayKey(task.day ? new Date(task.day) : null);
			const bucket = map.get(key);
			if (bucket) bucket.push(task);
			else map.set(key, [task]);
		}
		for (const bucket of map.values()) {
			bucket.sort((a, b) => a.sortOrder - b.sortOrder);
		}
		return map;
	}, [columns, project]);

	useEffect(() => {
		if (scrolledToToday.current || !todayColumnRef.current) return;
		todayColumnRef.current.scrollIntoView({ inline: "center" });
		scrolledToToday.current = true;
	});

	if (!project) return null;

	const goalKey = project.goalDate ? dayKey(new Date(project.goalDate)) : null;
	const todayKey = dayKey(today);
	const activeTask = activeId
		? (project.tasks.find((task) => task.id === activeId) ?? null)
		: null;

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);
		const overId = event.over?.id;
		if (overId == null) return;
		const targetKey = String(overId);
		const fromKey = event.active.data.current?.fromKey as string | undefined;
		if (fromKey === targetKey) return;

		const taskId = String(event.active.id);
		const day =
			targetKey === "unscheduled"
				? null
				: new Date(`${targetKey}T00:00:00.000Z`);
		const sortOrder = byColumn.get(targetKey)?.length ?? 0;
		taskMove.mutate({ id: taskId, day, sortOrder });
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCorners}
			onDragStart={(event: DragStartEvent) =>
				setActiveId(String(event.active.id))
			}
			onDragEnd={handleDragEnd}
			onDragCancel={() => setActiveId(null)}
		>
			<div
				ref={panRef}
				{...panHandlers}
				className="flex min-h-0 flex-1 cursor-grab gap-3 overflow-x-auto pb-4 active:cursor-grabbing"
			>
				{columns.map((column) => {
					const key = dayKey(column);
					const isToday = key === todayKey;
					return (
						<BoardColumn
							key={key}
							projectId={id}
							day={column}
							dayKeyValue={key}
							tasks={byColumn.get(key) ?? []}
							isToday={isToday}
							isGoal={goalKey !== null && key === goalKey}
							columnRef={isToday ? todayColumnRef : undefined}
						/>
					);
				})}
			</div>
			<DragOverlay dropAnimation={null}>
				{activeTask ? (
					<TaskCardBody projectId={id} task={activeTask} dragging />
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

function BoardColumn({
	projectId,
	day,
	dayKeyValue,
	tasks,
	isToday,
	isGoal,
	columnRef,
}: {
	projectId: string;
	day: Date | null;
	dayKeyValue: string;
	tasks: ProjectTask[];
	isToday: boolean;
	isGoal: boolean;
	columnRef?: RefObject<HTMLDivElement | null>;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: dayKeyValue });
	const done = tasks.filter((task) => task.status === "DONE").length;
	const allDone = tasks.length > 0 && done === tasks.length;

	return (
		<div ref={columnRef} className="flex w-72 min-h-0 shrink-0 flex-col">
			<div
				className={cn(
					"mb-2 rounded-lg border bg-card px-3 py-2.5",
					isGoal ? "border-primary" : "border-border",
				)}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="flex min-w-0 items-center gap-2 font-semibold text-foreground text-sm">
						<span
							className={cn(
								"h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40",
								allDone && "bg-primary",
							)}
						/>
						<span className="truncate">
							{day ? (
								<LocalDay date={dayKeyValue} options={HEADER_DAY_OPTIONS} />
							) : (
								"Unscheduled"
							)}
						</span>
						{isToday ? (
							<span className="shrink-0 font-medium text-primary text-xs">
								Today
							</span>
						) : null}
					</span>
					<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs font-medium">
						{done}/{tasks.length}
					</span>
				</div>
				{isGoal ? (
					<p className="mt-0.5 pl-4.5 font-medium text-primary text-xs">Goal</p>
				) : null}
			</div>
			<div
				ref={setNodeRef}
				className={cn(
					"flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-1 transition-colors",
					isOver && "bg-accent/60 ring-2 ring-primary/30",
				)}
			>
				{tasks.map((task) => (
					<TaskCard
						key={task.id}
						projectId={projectId}
						task={task}
						fromKey={dayKeyValue}
					/>
				))}
			</div>
			<div className="pt-2">
				<AddTaskInput projectId={projectId} day={day} />
			</div>
		</div>
	);
}
