"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Icon } from "@crm/ui/components/icon";
import { cn } from "@crm/ui/lib/utils";
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
					{tasks.map((task) => {
						const colors = task.crew
							? (CREW_COLOR_CLASSES[task.crew.color] ?? NO_CREW_CLASSES)
							: NO_CREW_CLASSES;
						return (
							<TaskPopover
								key={task.id}
								projectId={projectId}
								task={task}
								density={density}
							>
								<button
									type="button"
									className={cn(
										"flex items-center gap-1.5 truncate rounded-sm border px-2 py-1 text-xs",
										colors.bar,
									)}
								>
									<span
										className={cn("size-1.5 shrink-0 rounded-full", colors.dot)}
									/>
									<span className="truncate">{task.name}</span>
								</button>
							</TaskPopover>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
