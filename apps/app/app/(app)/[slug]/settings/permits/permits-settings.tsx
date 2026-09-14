"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { isPermitDisclaimerAccepted } from "@/lib/permits/permit-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { LockerManager } from "./locker-manager";
import {
	ACCEPT_DISCLAIMER,
	ADMIN_ONLY_NOTE,
	DISCLAIMER_NOT_ACCEPTED,
	DISCLAIMER_TITLE,
	disclaimerAccepted,
	ENABLE_HELP,
	ENABLE_LABEL,
	GENERAL_TITLE,
	NO_PIPELINES,
	STATES_HELP,
	STATES_LABEL,
	TRIGGER_STAGES_HELP,
	TRIGGER_STAGES_LABEL,
} from "./permits-copy";
import { PlaybooksBrowser } from "./playbooks-browser";

type Pipeline = RouterOutputs["pipelines"]["list"][number];
type UsState = RouterOutputs["settings"]["permits"]["permitStates"][number];

function permitsErrorMessage(error: { message: string }): string {
	return error.message;
}

function StatesPicker({
	states,
	selected,
	disabled,
	onToggle,
}: {
	states: UsState[];
	selected: Set<UsState>;
	disabled: boolean;
	onToggle: (state: UsState) => void;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{states.map((state) => (
				<Button
					key={state}
					type="button"
					size="xs"
					variant={selected.has(state) ? "default" : "outline"}
					disabled={disabled}
					onClick={() => onToggle(state)}
				>
					{state}
				</Button>
			))}
		</div>
	);
}

function TriggerStagePicker({
	pipelines,
	selected,
	disabled,
	onToggle,
}: {
	pipelines: Pipeline[];
	selected: Set<string>;
	disabled: boolean;
	onToggle: (stageId: string) => void;
}) {
	const live = pipelines.filter((pipeline) => !pipeline.archivedAt);

	if (live.length === 0) {
		return <p className="text-muted-foreground text-sm">{NO_PIPELINES}</p>;
	}

	return (
		<div className="flex flex-col gap-3">
			{live.map((pipeline) => (
				<div key={pipeline.id} className="flex flex-col gap-1.5">
					<span className="font-medium text-sm">{pipeline.name}</span>
					<div className="flex flex-col gap-1">
						{pipeline.stages
							.filter((stage) => !stage.archivedAt)
							.map((stage) => (
								<label
									key={stage.id}
									htmlFor={`permit-trigger-stage-${stage.id}`}
									className="group flex items-center gap-2 text-sm"
								>
									<Checkbox
										id={`permit-trigger-stage-${stage.id}`}
										checked={selected.has(stage.id)}
										disabled={disabled}
										onCheckedChange={() => onToggle(stage.id)}
									/>
									{stage.label}
								</label>
							))}
					</div>
				</div>
			))}
		</div>
	);
}

export function PermitsSettings({ states }: { states: UsState[] }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const permissions = useQuery(trpc.permissions.mine.queryOptions());
	const isAdmin = permissions.data?.isAdmin ?? false;

	const settings = useQuery(trpc.settings.permits.queryOptions());
	const users = useQuery(trpc.users.list.queryOptions());
	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: false }),
	);

	const setPermits = useMutation(
		trpc.settings.setPermits.mutationOptions({
			onSuccess: () => cache.settings(),
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);

	const acceptDisclaimer = useMutation(
		trpc.settings.acceptPermitDisclaimer.mutationOptions({
			onSuccess: () => cache.settings(),
			onError: (error: { message: string }) =>
				toast.error(permitsErrorMessage(error)),
		}),
	);

	const data = settings.data;
	const disclaimerIsAccepted = isPermitDisclaimerAccepted(
		data?.disclaimer ?? null,
	);
	const selectedStates = new Set(data?.permitStates ?? []);
	const selectedStages = new Set(data?.permitTriggerStageIds ?? []);
	const acceptedByName =
		data?.disclaimer && users.data
			? (users.data.find((user) => user.id === data.disclaimer?.acceptedById)
					?.name ?? null)
			: null;

	const toggleState = (state: UsState) => {
		const next = new Set(selectedStates);
		if (next.has(state)) next.delete(state);
		else next.add(state);
		setPermits.mutate({ states: [...next] });
	};

	const toggleStage = (stageId: string) => {
		const next = new Set(selectedStages);
		if (next.has(stageId)) next.delete(stageId);
		else next.add(stageId);
		setPermits.mutate({ triggerStageIds: [...next] });
	};

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>{GENERAL_TITLE}</CardTitle>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<div className="flex items-center justify-between gap-3">
								<FieldLabel>{ENABLE_LABEL}</FieldLabel>
								<Switch
									checked={data?.permitsEnabled ?? false}
									disabled={!isAdmin || setPermits.isPending}
									onCheckedChange={(enabled) => setPermits.mutate({ enabled })}
								/>
							</div>
							<FieldDescription>{ENABLE_HELP}</FieldDescription>
						</Field>

						<Field>
							<FieldLabel>{STATES_LABEL}</FieldLabel>
							<FieldDescription>{STATES_HELP}</FieldDescription>
							<StatesPicker
								states={states}
								selected={selectedStates}
								disabled={!isAdmin || setPermits.isPending}
								onToggle={toggleState}
							/>
						</Field>

						<Field>
							<FieldLabel>{TRIGGER_STAGES_LABEL}</FieldLabel>
							<FieldDescription>{TRIGGER_STAGES_HELP}</FieldDescription>
							<TriggerStagePicker
								pipelines={pipelines.data ?? []}
								selected={selectedStages}
								disabled={!isAdmin || setPermits.isPending}
								onToggle={toggleStage}
							/>
						</Field>

						{isAdmin ? null : (
							<FieldDescription>{ADMIN_ONLY_NOTE}</FieldDescription>
						)}
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{DISCLAIMER_TITLE}</CardTitle>
					<CardDescription>
						{data?.disclaimer && disclaimerIsAccepted
							? disclaimerAccepted(
									acceptedByName,
									new Date(data.disclaimer.acceptedAt).toLocaleDateString(),
								)
							: DISCLAIMER_NOT_ACCEPTED}
					</CardDescription>
				</CardHeader>
				{data && !disclaimerIsAccepted ? (
					<CardContent>
						<Button
							type="button"
							size="sm"
							disabled={acceptDisclaimer.isPending}
							onClick={() => acceptDisclaimer.mutate(undefined)}
						>
							{ACCEPT_DISCLAIMER}
						</Button>
					</CardContent>
				) : null}
			</Card>

			<LockerManager />

			<PlaybooksBrowser />
		</div>
	);
}
