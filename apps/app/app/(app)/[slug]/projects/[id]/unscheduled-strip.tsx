"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import Draggable from "@carbon/icons-react/es/Draggable";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import type { BoardDensity } from "@/components/board/use-board-density";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { type ProjectTaskLike, TaskPopover } from "./task-card";

export function UnscheduledStrip({
	projectId,
	tasks,
	density,
}: {
	projectId: string;
	tasks: ProjectTaskLike[];
	density?: BoardDensity;
}) {
	const [open, setOpen] = useState(true);
	const compact = density === "compact";

	if (tasks.length === 0) return null;

	return (
		<div
			className={cn(
				"flex flex-col rounded-lg border border-border",
				compact ? "gap-1.5 p-1.5" : "gap-2 p-2",
			)}
		>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => setOpen((prev) => !prev)}
					className="flex items-center gap-1 text-sm font-medium text-foreground"
				>
					<Icon icon={open ? ChevronDown : ChevronRight} className="size-4" />
					Unscheduled · {tasks.length}
				</button>
				{open ? (
					<span className="text-xs text-muted-foreground">
						Drag a task onto a day to schedule it
					</span>
				) : null}
			</div>
			{open ? (
				<div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1.5")}>
					{tasks.map((task) => (
						<UnscheduledChip
							key={task.id}
							projectId={projectId}
							task={task}
							density={density}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function UnscheduledChip({
	projectId,
	task,
	density,
}: {
	projectId: string;
	task: ProjectTaskLike;
	density?: BoardDensity;
}) {
	const colors = task.crew
		? (CREW_COLOR_CLASSES[task.crew.color] ?? NO_CREW_CLASSES)
		: NO_CREW_CLASSES;
	const compact = density === "compact";
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: task.id,
	});

	return (
		<div
			ref={setNodeRef}
			data-board-drag=""
			className={cn(
				"flex cursor-grab items-center truncate rounded-sm border text-xs touch-none select-none active:cursor-grabbing",
				compact ? "gap-1 px-1.5 py-0.5" : "gap-1.5 px-2 py-1",
				colors.bar,
				isDragging && "opacity-40",
			)}
			{...attributes}
			{...listeners}
		>
			<Icon icon={Draggable} className="size-3 shrink-0 opacity-60" />
			<span className={cn("size-1.5 shrink-0 rounded-full", colors.dot)} />
			<TaskPopover projectId={projectId} task={task} density={density}>
				<button type="button" className="truncate">
					{task.name}
				</button>
			</TaskPopover>
		</div>
	);
}
