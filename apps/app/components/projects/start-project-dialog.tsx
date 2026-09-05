"use client";

import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { toDay } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function StartProjectDialog({
	dealId,
	dealName,
	expectedCloseDate,
	trigger,
}: {
	dealId: string;
	dealName: string;
	expectedCloseDate?: string | null;
	trigger: ReactNode;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const [open, setOpen] = useState(false);
	const [name, setName] = useState(dealName);
	const [startDate, setStartDate] = useState(() => toDay(new Date()));
	const [goalDate, setGoalDate] = useState(expectedCloseDate ?? "");
	const [goal, setGoal] = useState("");

	const nameId = useId();
	const startDateId = useId();
	const goalDateId = useId();
	const goalId = useId();

	const reset = () => {
		setName(dealName);
		setStartDate(toDay(new Date()));
		setGoalDate(expectedCloseDate ?? "");
		setGoal("");
	};

	const create = useMutation(
		trpc.projects.create.mutationOptions({
			onSuccess: async (project) => {
				await cache.project(project.id);
				setOpen(false);
				reset();
				router.push(workspaceUrl(`/projects/${project.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const ready = name.trim() !== "" && startDate !== "";

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Start a project</DialogTitle>
					<DialogDescription>
						Track the work for {dealName} day by day.
					</DialogDescription>
				</DialogHeader>

				<form
					id="start-project"
					onSubmit={(event) => {
						event.preventDefault();
						if (!ready) return;
						create.mutate({
							dealId,
							name: name.trim(),
							goal: goal.trim() || undefined,
							startDate,
							goalDate: goalDate || undefined,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={startDateId}>Start date</FieldLabel>
							<DatePicker
								id={startDateId}
								value={startDate}
								onChange={setStartDate}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={goalDateId}>Goal date</FieldLabel>
							<DatePicker
								id={goalDateId}
								value={goalDate}
								onChange={setGoalDate}
								placeholder="No goal date yet"
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={goalId}>Goal</FieldLabel>
							<Textarea
								id={goalId}
								value={goal}
								onChange={(event) => setGoal(event.target.value)}
								placeholder="What done looks like."
							/>
						</Field>
					</FieldGroup>
				</form>

				<DialogFooter>
					<Button
						type="submit"
						form="start-project"
						disabled={!ready || create.isPending}
					>
						{create.isPending ? <Spinner /> : null}
						Start project
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
