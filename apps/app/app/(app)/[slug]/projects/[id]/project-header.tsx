"use client";

import TrashCan from "@carbon/icons-react/es/TrashCan";
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
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Project = RouterOutputs["projects"]["byId"];

const DAY_MS = 86_400_000;

const STATUS_OPTIONS: { value: Project["status"]; label: string }[] = [
	{ value: "ACTIVE", label: "Active" },
	{ value: "ON_HOLD", label: "On hold" },
	{ value: "COMPLETE", label: "Complete" },
];

function todayUtc(): number {
	const now = new Date();
	return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function countdown(goalDate: string | null): string | null {
	if (!goalDate) return null;
	const goalTime = new Date(goalDate).getTime();
	const days = Math.ceil((goalTime - todayUtc()) / DAY_MS);
	if (days < 0) return "Goal passed";
	if (days === 0) return "Goal is today";
	return `${days} day${days === 1 ? "" : "s"} to goal`;
}

export function ProjectHeader({ id }: { id: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const openRecord = useOpenRecord();
	const [editingName, setEditingName] = useState(false);
	const [name, setName] = useState("");
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const query = useQuery(trpc.projects.byId.queryOptions({ id }));
	const project = query.data;

	const update = useMutation(
		trpc.projects.update.mutationOptions({
			onSuccess: () => cache.project(id, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.projects.remove.mutationOptions({
			onSuccess: async (deleted) => {
				toast.success(`${deleted.name || "The project"} was deleted.`);
				await cache.project(id);
				router.push(workspaceUrl("/projects"));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!project) return null;

	const total = project.tasks.length;
	const done = project.tasks.filter((task) => task.status === "DONE").length;
	const goalCountdown = countdown(project.goalDate);

	const startEditingName = () => {
		setName(project.name);
		setEditingName(true);
	};

	const commitName = () => {
		const trimmed = name.trim();
		setEditingName(false);
		if (trimmed && trimmed !== project.name) {
			update.mutate({ id, name: trimmed });
		}
	};

	return (
		<div className="flex flex-col gap-3 border-b border-border pb-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-1">
					{editingName ? (
						<Input
							autoFocus
							value={name}
							onChange={(event) => setName(event.target.value)}
							onBlur={commitName}
							onKeyDown={(event) => {
								if (event.key === "Enter") commitName();
								if (event.key === "Escape") setEditingName(false);
							}}
							className="h-9 max-w-md text-base font-medium"
						/>
					) : (
						<button
							type="button"
							onClick={startEditingName}
							className="truncate text-left font-medium text-2xl text-foreground tracking-tight hover:text-foreground/80"
						>
							{project.name}
						</button>
					)}

					<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
						<button
							type="button"
							onClick={() => openRecord({ kind: "deal", id: project.deal.id })}
							className="truncate underline-offset-2 hover:underline"
						>
							{project.deal.name}
						</button>
						{project.deal.company ? (
							<>
								<span aria-hidden>·</span>
								<button
									type="button"
									onClick={() =>
										openRecord({
											kind: "company",
											id: project.deal.company?.id ?? "",
										})
									}
									className="truncate underline-offset-2 hover:underline"
								>
									{project.deal.company.name}
								</button>
							</>
						) : null}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<Select
						value={project.status}
						onValueChange={(status) =>
							update.mutate({ id, status: status as Project["status"] })
						}
					>
						<SelectTrigger size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => setConfirmingDelete(true)}
					>
						<Icon icon={TrashCan} />
						<span className="sr-only">Delete project</span>
					</Button>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
				<span className="truncate">{project.goal || "No goal set."}</span>
				{goalCountdown ? (
					<span className="font-medium text-foreground">{goalCountdown}</span>
				) : null}
				<span className="tabular-nums">
					{done}/{total} tasks done
				</span>
			</div>

			<AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Its tasks go with it. {project.deal.name} stays in the CRM.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => remove.mutate({ id })}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
