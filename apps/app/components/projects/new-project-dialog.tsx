"use client";

import Add from "@carbon/icons-react/es/Add";
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
import { Icon } from "@crm/ui/components/icon";
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

export type NewProjectDefaults = {
	name?: string;
	dealId?: string;
	contactId?: string;
	estimateId?: string;
	invoiceId?: string;
};

export function NewProjectDialog({
	trigger,
	defaults,
	open: openProp,
	onOpenChange,
}: {
	trigger?: ReactNode;
	defaults?: NewProjectDefaults;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
} = {}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	const [internalOpen, setInternalOpen] = useState(false);
	const open = openProp ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;
	const [name, setName] = useState(defaults?.name ?? "");
	const [startDate, setStartDate] = useState(() => toDay(new Date()));
	const [goalDate, setGoalDate] = useState("");
	const [goal, setGoal] = useState("");

	const nameId = useId();
	const startDateId = useId();
	const goalDateId = useId();
	const goalId = useId();

	const reset = () => {
		setName(defaults?.name ?? "");
		setStartDate(toDay(new Date()));
		setGoalDate("");
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
			{openProp === undefined ? (
				<DialogTrigger asChild>
					{trigger ?? (
						<Button size="sm">
							<Icon icon={Add} data-icon="inline-start" />
							New project
						</Button>
					)}
				</DialogTrigger>
			) : null}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New project</DialogTitle>
					<DialogDescription>
						{defaults?.invoiceId || defaults?.dealId || defaults?.contactId
							? "Plan the work day by day. The linked records come attached."
							: "Plan the work day by day. Attach a client, estimate or invoice from the project page afterwards."}
					</DialogDescription>
				</DialogHeader>

				<form
					id="new-project"
					onSubmit={(event) => {
						event.preventDefault();
						if (!ready) return;
						create.mutate({
							name: name.trim(),
							goal: goal.trim() || undefined,
							startDate,
							goalDate: goalDate || undefined,
							dealId: defaults?.dealId,
							contactId: defaults?.contactId,
							estimateId: defaults?.estimateId,
							invoiceId: defaults?.invoiceId,
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
						form="new-project"
						disabled={!ready || create.isPending}
					>
						{create.isPending ? <Spinner /> : null}
						Create project
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
