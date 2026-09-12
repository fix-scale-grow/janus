"use client";

import Draggable from "@carbon/icons-react/es/Draggable";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "@tanstack/react-query";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { BoardDensity } from "@/components/board/use-board-density";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { CALENDAR } from "@/lib/calendar/calendar-config";
import { addDays, dayKey, type WeekBar } from "@/lib/calendar/span-layout";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { CalendarTask } from "./calendar-view";
import { TaskPopover } from "./task-card";

const DAY_MS = 86_400_000;

export const TASK_BAR_CLASSES =
	"pointer-events-auto flex h-6 cursor-grab items-center gap-1 truncate rounded-sm border px-1.5 text-xs touch-none select-none active:cursor-grabbing";

const TASK_BAR_CLASSES_COMPACT =
	"pointer-events-auto flex h-5 items-center gap-0.5 truncate rounded-sm border px-1 text-xs touch-none select-none";

export function taskBarClasses(density?: BoardDensity): string {
	return density === "compact" ? TASK_BAR_CLASSES_COMPACT : TASK_BAR_CLASSES;
}

const LANE_HEIGHT_REM: Record<BoardDensity, number> = {
	comfortable: 1.75,
	compact: 1.375,
};

export function barClasses(
	task: Pick<CalendarTask, "crew" | "status">,
): string {
	const colors = task.crew
		? (CREW_COLOR_CLASSES[task.crew.color] ?? NO_CREW_CLASSES)
		: NO_CREW_CLASSES;
	return cn("border", colors.bar, task.status === "DONE" && "opacity-60");
}

export function TaskBar({
	bar,
	projectId,
	density,
}: {
	bar: WeekBar<CalendarTask>;
	weekStart: Date;
	projectId: string;
	density?: BoardDensity;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id: bar.task.id,
			data: { startKey: dayKey(bar.task.startDay) },
		});
	const [previewEndDelta, setPreviewEndDelta] = useState(0);
	const [previewStartDelta, setPreviewStartDelta] = useState(0);
	const done = bar.task.status === "DONE";
	const displayEndCol = bar.clippedEnd
		? bar.endCol
		: Math.max(bar.startCol, Math.min(6, bar.endCol + previewEndDelta));
	const displayStartCol = bar.clippedStart
		? bar.startCol
		: Math.min(displayEndCol, Math.max(0, bar.startCol + previewStartDelta));

	return (
		<div
			ref={setNodeRef}
			data-board-drag=""
			style={{
				gridColumn: `${displayStartCol + 1} / ${displayEndCol + 2}`,
				marginTop: `${bar.lane * LANE_HEIGHT_REM[density ?? "comfortable"]}rem`,
				transform: CSS.Translate.toString(transform),
			}}
			className={cn(
				taskBarClasses(density),
				barClasses(bar.task),
				bar.clippedStart && "rounded-l-none border-l-0",
				bar.clippedEnd && "rounded-r-none border-r-0",
				isDragging && "opacity-40",
			)}
			{...attributes}
			{...listeners}
		>
			{!bar.clippedStart ? (
				<ResizeHandle
					edge="start"
					task={bar.task}
					projectId={projectId}
					onPreview={setPreviewStartDelta}
					bounds={{ min: -bar.startCol, max: bar.endCol - bar.startCol }}
				/>
			) : null}
			{!bar.clippedStart ? (
				<Icon icon={Draggable} className="size-3 shrink-0 opacity-60" />
			) : null}
			<TaskPopover projectId={projectId} task={bar.task} density={density}>
				<span className="truncate">
					{done ? "✓ " : ""}
					{bar.task.name}
				</span>
			</TaskPopover>
			{!bar.clippedEnd ? (
				<ResizeHandle
					edge="end"
					task={bar.task}
					projectId={projectId}
					onPreview={setPreviewEndDelta}
					bounds={{ min: bar.startCol - bar.endCol, max: 6 - bar.endCol }}
				/>
			) : null}
		</div>
	);
}

function ResizeHandle({
	edge,
	task,
	projectId,
	onPreview,
	bounds,
}: {
	edge: "start" | "end";
	task: CalendarTask;
	projectId: string;
	onPreview: (deltaDays: number) => void;
	bounds: { min: number; max: number };
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const drag = useRef<{ startX: number; cellWidth: number } | null>(null);

	const taskMove = useMutation(
		trpc.projects.taskMove.mutationOptions({
			onSuccess: () => cache.project(projectId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const clampEnd = (endDay: Date): Date => {
		const maxEnd = addDays(task.startDay, CALENDAR.maxTaskSpanDays - 1);
		if (endDay.getTime() < task.startDay.getTime()) return task.startDay;
		if (endDay.getTime() > maxEnd.getTime()) return maxEnd;
		return endDay;
	};

	const clampStart = (startDay: Date): Date => {
		const minStart = addDays(task.endDay, -(CALENDAR.maxTaskSpanDays - 1));
		if (startDay.getTime() > task.endDay.getTime()) return task.endDay;
		if (startDay.getTime() < minStart.getTime()) return minStart;
		return startDay;
	};

	const clampedDelta = (rawDelta: number): number => {
		const visible = Math.min(bounds.max, Math.max(bounds.min, rawDelta));
		if (edge === "start") {
			const clamped = clampStart(addDays(task.startDay, visible));
			return Math.round((clamped.getTime() - task.startDay.getTime()) / DAY_MS);
		}
		const clamped = clampEnd(addDays(task.endDay, visible));
		return Math.round((clamped.getTime() - task.endDay.getTime()) / DAY_MS);
	};

	const rawDeltaDays = (
		event: { clientX: number },
		state: { startX: number; cellWidth: number },
	) => Math.round((event.clientX - state.startX) / state.cellWidth);

	const onPointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
		event.stopPropagation();
		const row = event.currentTarget.closest("[data-week-row]");
		const cellWidth = row ? row.getBoundingClientRect().width / 7 : 40;
		drag.current = { startX: event.clientX, cellWidth };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
		const state = drag.current;
		if (!state) return;
		if ((event.buttons & 1) === 0) {
			drag.current = null;
			onPreview(0);
			return;
		}
		onPreview(clampedDelta(rawDeltaDays(event, state)));
	};

	const onPointerCancel = () => {
		drag.current = null;
		onPreview(0);
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
		const state = drag.current;
		if (!state) return;
		drag.current = null;
		onPreview(0);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		const delta = clampedDelta(rawDeltaDays(event, state));
		if (delta === 0) return;
		taskMove.mutate({
			id: task.id,
			startDay:
				edge === "start" ? addDays(task.startDay, delta) : task.startDay,
			endDay: edge === "end" ? addDays(task.endDay, delta) : task.endDay,
			sortOrder: task.sortOrder,
		});
	};

	return (
		<span
			className="flex w-2 shrink-0 cursor-ew-resize items-center justify-center self-stretch"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onLostPointerCapture={onPointerCancel}
		>
			<span className="h-3 w-0.5 rounded-sm bg-current opacity-30" />
		</span>
	);
}
