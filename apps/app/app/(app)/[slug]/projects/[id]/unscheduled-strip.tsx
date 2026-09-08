"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { type ProjectTaskLike, TaskPopover } from "./task-card";

export function UnscheduledStrip({
	projectId,
	tasks,
}: {
	projectId: string;
	tasks: ProjectTaskLike[];
}) {
	const [open, setOpen] = useState(true);

	if (tasks.length === 0) return null;

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-border p-2">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className="flex items-center gap-1 text-sm font-medium text-foreground"
			>
				<Icon icon={open ? ChevronDown : ChevronRight} className="size-4" />
				Unscheduled · {tasks.length}
			</button>
			{open ? (
				<div className="flex flex-wrap gap-1.5">
					{tasks.map((task) => (
						<UnscheduledChip key={task.id} projectId={projectId} task={task} />
					))}
				</div>
			) : null}
		</div>
	);
}

function UnscheduledChip({
	projectId,
	task,
}: {
	projectId: string;
	task: ProjectTaskLike;
}) {
	const colors = task.crew
		? (CREW_COLOR_CLASSES[task.crew.color] ?? NO_CREW_CLASSES)
		: NO_CREW_CLASSES;
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: task.id,
	});

	return (
		<div
			ref={setNodeRef}
			data-board-drag=""
			className={cn(
				"flex cursor-grab items-center gap-1.5 truncate rounded-sm border px-2 py-1 text-xs touch-none select-none",
				colors.bar,
				isDragging && "opacity-40",
			)}
			{...attributes}
			{...listeners}
		>
			<span className={cn("size-1.5 shrink-0 rounded-full", colors.dot)} />
			<TaskPopover projectId={projectId} task={task}>
				<button type="button" className="truncate">
					{task.name}
				</button>
			</TaskPopover>
		</div>
	);
}
