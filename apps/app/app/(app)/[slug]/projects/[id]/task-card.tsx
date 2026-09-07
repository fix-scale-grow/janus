"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { dayKey, fromDayKey } from "@/lib/calendar/span-layout";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Project = RouterOutputs["projects"]["byId"];
export type ProjectTask = Project["tasks"][number];
export type ProjectTaskLike = Omit<ProjectTask, "startDay" | "endDay"> & {
	startDay: string | Date | null;
	endDay: string | Date | null;
};

const STATUS_FLOW: Record<ProjectTask["status"], ProjectTask["status"]> = {
	TODO: "IN_PROGRESS",
	IN_PROGRESS: "DONE",
	DONE: "TODO",
};

const STATUS_LABEL: Record<ProjectTask["status"], string> = {
	TODO: "To do",
	IN_PROGRESS: "In progress",
	DONE: "Done",
};

const STATUS_VARIANT: Record<
	ProjectTask["status"],
	"outline" | "secondary" | "default"
> = {
	TODO: "outline",
	IN_PROGRESS: "secondary",
	DONE: "default",
};

function asDate(value: string | Date): Date {
	return typeof value === "string" ? new Date(value) : value;
}

function toDayKey(value: Date | string | null): string | null {
	return value ? dayKey(asDate(value)) : null;
}

export function TaskPopover({
	projectId,
	task,
	children,
}: {
	projectId: string;
	task: ProjectTaskLike;
	children: ReactNode;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState(task.name);
	const [note, setNote] = useState(task.note ?? "");

	const users = useQuery(trpc.users.list.queryOptions());
	const crews = useQuery(trpc.crews.list.queryOptions());

	const cycleStatus = useMutation(
		trpc.projects.taskUpdate.mutationOptions({
			onMutate: async ({ id, status }) => {
				const key = trpc.projects.byId.queryKey({ id: projectId });
				await queryClient.cancelQueries({ queryKey: key });
				const previous = queryClient.getQueryData<Project>(key);
				queryClient.setQueryData<Project>(key, (data) => {
					if (!data || !status) return data;
					return {
						...data,
						tasks: data.tasks.map((row) =>
							row.id === id ? { ...row, status } : row,
						),
					};
				});
				return { previous };
			},
			onError: (error, _variables, context) => {
				if (context?.previous) {
					queryClient.setQueryData(
						trpc.projects.byId.queryKey({ id: projectId }),
						context.previous,
					);
				}
				toast.error(error.message);
			},
			onSettled: () => void cache.project(projectId),
		}),
	);

	const update = useMutation(
		trpc.projects.taskUpdate.mutationOptions({
			onSuccess: () => cache.project(projectId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const taskMove = useMutation(
		trpc.projects.taskMove.mutationOptions({
			onSuccess: () => cache.project(projectId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.projects.taskRemove.mutationOptions({
			onSuccess: () => cache.project(projectId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const commitName = () => {
		const trimmed = name.trim();
		if (trimmed && trimmed !== task.name) {
			update.mutate({ id: task.id, name: trimmed });
		} else {
			setName(task.name);
		}
	};

	const commitNote = () => {
		const trimmed = note.trim();
		if (trimmed !== (task.note ?? "")) {
			update.mutate({ id: task.id, note: trimmed || null });
		}
	};

	const commitStart = (next: string) => {
		if (!next) {
			taskMove.mutate({
				id: task.id,
				startDay: null,
				endDay: null,
				sortOrder: task.sortOrder,
			});
			return;
		}
		const startDay = fromDayKey(next);
		const currentEnd = task.endDay ? asDate(task.endDay) : startDay;
		const endDay =
			currentEnd.getTime() < startDay.getTime() ? startDay : currentEnd;
		taskMove.mutate({
			id: task.id,
			startDay,
			endDay,
			sortOrder: task.sortOrder,
		});
	};

	const commitEnd = (next: string) => {
		if (!task.startDay) return;
		const startDay = asDate(task.startDay);
		const endDay = next ? fromDayKey(next) : startDay;
		taskMove.mutate({
			id: task.id,
			startDay,
			endDay,
			sortOrder: task.sortOrder,
		});
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setName(task.name);
					setNote(task.note ?? "");
				}
			}}
		>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				align="start"
				className="flex flex-col gap-2.5"
				onClick={(event) => event.stopPropagation()}
			>
				<button
					type="button"
					onClick={() =>
						cycleStatus.mutate({
							id: task.id,
							status: STATUS_FLOW[task.status],
						})
					}
					disabled={cycleStatus.isPending}
					className="self-start"
				>
					<Badge variant={STATUS_VARIANT[task.status]}>
						{STATUS_LABEL[task.status]}
					</Badge>
				</button>
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					onBlur={commitName}
					placeholder="Task name"
				/>
				<Textarea
					value={note}
					onChange={(event) => setNote(event.target.value)}
					onBlur={commitNote}
					placeholder="Note"
					rows={3}
				/>
				<Select
					value={task.assignee?.id ?? "unassigned"}
					onValueChange={(value) =>
						update.mutate({
							id: task.id,
							assigneeId: value === "unassigned" ? null : value,
						})
					}
				>
					<SelectTrigger size="sm" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="unassigned">Unassigned</SelectItem>
						{(users.data ?? []).map((user) => (
							<SelectItem key={user.id} value={user.id}>
								{user.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={task.crew?.id ?? "none"}
					onValueChange={(value) =>
						update.mutate({
							id: task.id,
							crewId: value === "none" ? null : value,
						})
					}
				>
					<SelectTrigger size="sm" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No crew</SelectItem>
						{(crews.data ?? [])
							.filter((crew) => !crew.archived)
							.map((crew) => (
								<SelectItem key={crew.id} value={crew.id}>
									<span
										className={cn(
											"size-2 shrink-0 rounded-full",
											(CREW_COLOR_CLASSES[crew.color] ?? NO_CREW_CLASSES).dot,
										)}
									/>
									{crew.name}
								</SelectItem>
							))}
					</SelectContent>
				</Select>
				<div className="flex items-center gap-2">
					<DatePicker
						value={toDayKey(task.startDay)}
						onChange={commitStart}
						placeholder="Start"
					/>
					<DatePicker
						value={toDayKey(task.endDay)}
						onChange={commitEnd}
						placeholder="End"
					/>
				</div>
				<Button
					variant="destructive"
					size="sm"
					disabled={remove.isPending}
					onClick={() => remove.mutate({ id: task.id })}
				>
					Remove task
				</Button>
			</PopoverContent>
		</Popover>
	);
}
