"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
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
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Project = RouterOutputs["projects"]["byId"];
export type ProjectTask = Project["tasks"][number];

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

export function TaskCard({
	projectId,
	task,
	fromKey,
	dragging = false,
}: {
	projectId: string;
	task: ProjectTask;
	fromKey: string;
	dragging?: boolean;
}) {
	const { setNodeRef, listeners, transform, isDragging } = useDraggable({
		id: task.id,
		data: { fromKey },
	});

	return (
		<div
			ref={setNodeRef}
			{...listeners}
			data-board-drag=""
			style={{
				transform: CSS.Translate.toString(transform),
				opacity: isDragging ? 0.4 : 1,
			}}
			className="cursor-grab touch-none select-none active:cursor-grabbing"
		>
			<TaskCardBody projectId={projectId} task={task} dragging={dragging} />
		</div>
	);
}

export function TaskCardBody({
	projectId,
	task,
	dragging = false,
}: {
	projectId: string;
	task: ProjectTask;
	dragging?: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const cache = useCrmCache();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState(task.name);
	const [note, setNote] = useState(task.note ?? "");

	const users = useQuery(trpc.users.list.queryOptions());

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
			<PopoverTrigger asChild>
				<div
					className={
						dragging
							? "flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-xl"
							: "flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
					}
				>
					<span className="flex items-start justify-between gap-2">
						<span className="min-w-0 truncate text-foreground text-sm font-medium">
							{task.name}
						</span>
						{task.assignee ? (
							<PersonAvatar
								src={task.assignee.image}
								name={task.assignee.name}
								size="sm"
							/>
						) : null}
					</span>
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							cycleStatus.mutate({
								id: task.id,
								status: STATUS_FLOW[task.status],
							});
						}}
						disabled={cycleStatus.isPending}
						className="self-start"
					>
						<Badge variant={STATUS_VARIANT[task.status]}>
							{STATUS_LABEL[task.status]}
						</Badge>
					</button>
				</div>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="flex flex-col gap-2.5"
				onClick={(event) => event.stopPropagation()}
			>
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
