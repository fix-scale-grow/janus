"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { DatePicker } from "@crm/ui/components/date-picker";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Textarea } from "@crm/ui/components/textarea";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { fromDayKey } from "@/lib/calendar/span-layout";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { ProjectTask } from "./task-card";

const STATUS_OPTIONS: { value: ProjectTask["status"]; label: string }[] = [
	{ value: "TODO", label: "To do" },
	{ value: "IN_PROGRESS", label: "In progress" },
	{ value: "DONE", label: "Done" },
];

export function AddTaskPanel({
	projectId,
	open,
	onOpenChange,
	defaultStartDay,
}: {
	projectId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultStartDay: string | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const users = useQuery(trpc.users.list.queryOptions());
	const crews = useQuery(trpc.crews.list.queryOptions());

	const [name, setName] = useState("");
	const [note, setNote] = useState("");
	const [startDay, setStartDay] = useState<string | null>(defaultStartDay);
	const [endDay, setEndDay] = useState<string | null>(defaultStartDay);
	const [endTouched, setEndTouched] = useState(false);
	const [crewId, setCrewId] = useState<string | null>(null);
	const [assigneeId, setAssigneeId] = useState<string | null>(null);
	const [status, setStatus] = useState<ProjectTask["status"]>("TODO");
	const [createAnother, setCreateAnother] = useState(false);

	useEffect(() => {
		if (!open) return;
		setStartDay(defaultStartDay);
		setEndDay(defaultStartDay);
		setEndTouched(false);
	}, [open, defaultStartDay]);

	const setStatusMutation = useMutation(
		trpc.projects.taskUpdate.mutationOptions({
			onSuccess: () => void cache.project(projectId),
			onError: (error) => toast.error(error.message),
		}),
	);

	const create = useMutation(
		trpc.projects.taskCreate.mutationOptions({
			onSuccess: (created) => {
				if (status !== "TODO") {
					setStatusMutation.mutate({ id: created.id, status });
				}
				void cache.project(projectId);
				setName("");
				setNote("");
				if (!createAnother) {
					onOpenChange(false);
				}
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		create.mutate({
			projectId,
			name: trimmed,
			startDay: startDay ? fromDayKey(startDay) : null,
			endDay: endDay ? fromDayKey(endDay) : null,
			crewId: crewId ?? undefined,
			assigneeId: assigneeId ?? undefined,
			note: note.trim() || undefined,
		});
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>Add task</SheetTitle>
				</SheetHeader>
				<div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
					<Input
						autoFocus
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Task name"
					/>
					<div className="flex items-center gap-2">
						<DatePicker
							value={startDay}
							onChange={(next) => {
								setStartDay(next || null);
								if (!endTouched) setEndDay(next || null);
							}}
							placeholder="Start"
						/>
						<DatePicker
							value={endDay}
							onChange={(next) => {
								setEndTouched(true);
								setEndDay(next || null);
							}}
							placeholder="End"
						/>
					</div>
					<Select
						value={crewId ?? "none"}
						onValueChange={(value) =>
							setCrewId(value === "none" ? null : value)
						}
					>
						<SelectTrigger size="sm" className="w-full">
							<SelectValue placeholder="No crew" />
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
					<Select
						value={assigneeId ?? "unassigned"}
						onValueChange={(value) =>
							setAssigneeId(value === "unassigned" ? null : value)
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
						value={status}
						onValueChange={(value) => setStatus(value as ProjectTask["status"])}
					>
						<SelectTrigger size="sm" className="w-full">
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
					<Textarea
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder="Note"
						rows={3}
					/>
				</div>
				<SheetFooter>
					<div className="flex items-center gap-2">
						<Checkbox
							id="create-another"
							checked={createAnother}
							onCheckedChange={(checked) => setCreateAnother(checked === true)}
						/>
						<label
							htmlFor="create-another"
							className="text-xs text-muted-foreground"
						>
							Create another
						</label>
					</div>
					<Button disabled={!name.trim() || create.isPending} onClick={submit}>
						Add task
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
