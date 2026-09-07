"use client";

import { cn } from "@crm/ui/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "@tanstack/react-query";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
	"pointer-events-auto flex h-6 items-center gap-1 truncate rounded-sm border px-1.5 text-xs touch-none select-none";

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
}: {
	bar: WeekBar<CalendarTask>;
	weekStart: Date;
	projectId: string;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id: bar.task.id,
			data: { startKey: dayKey(bar.task.startDay) },
		});
	const [previewDelta, setPreviewDelta] = useState(0);
	const done = bar.task.status === "DONE";
	const displayEndCol = bar.clippedEnd
		? bar.endCol
		: Math.max(bar.startCol, Math.min(6, bar.endCol + previewDelta));

	return (
		<div
			ref={setNodeRef}
			data-board-drag=""
			style={{
				gridColumn: `${bar.startCol + 1} / ${displayEndCol + 2}`,
				marginTop: `${bar.lane * 1.75}rem`,
				transform: CSS.Translate.toString(transform),
			}}
			className={cn(
				TASK_BAR_CLASSES,
				barClasses(bar.task),
				bar.clippedStart && "rounded-l-none border-l-0",
				bar.clippedEnd && "rounded-r-none border-r-0",
				isDragging && "opacity-40",
			)}
			{...attributes}
			{...listeners}
		>
			<TaskPopover projectId={projectId} task={bar.task}>
				<span className="truncate">
					{done ? "✓ " : ""}
					{bar.task.name}
				</span>
			</TaskPopover>
			{!bar.clippedEnd ? (
				<ResizeHandle
					task={bar.task}
					projectId={projectId}
					onPreview={setPreviewDelta}
				/>
			) : null}
		</div>
	);
}

function ResizeHandle({
	task,
	projectId,
	onPreview,
}: {
	task: CalendarTask;
	projectId: string;
	onPreview: (deltaDays: number) => void;
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
		const clampedEnd = clampEnd(
			addDays(task.endDay, rawDeltaDays(event, state)),
		);
		onPreview(
			Math.round((clampedEnd.getTime() - task.endDay.getTime()) / DAY_MS),
		);
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
		const state = drag.current;
		if (!state) return;
		drag.current = null;
		onPreview(0);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		const delta = rawDeltaDays(event, state);
		if (delta === 0) return;
		const endDay = clampEnd(addDays(task.endDay, delta));
		taskMove.mutate({
			id: task.id,
			startDay: task.startDay,
			endDay,
			sortOrder: task.sortOrder,
		});
	};

	return (
		<span
			className="w-1.5 shrink-0 cursor-ew-resize self-stretch"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		/>
	);
}
