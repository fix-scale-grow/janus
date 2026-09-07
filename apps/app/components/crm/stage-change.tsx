"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import { requiresReason } from "@crm/db/stage-semantics";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";
import { useId, useState } from "react";
import { toast } from "sonner";
import { findStageById, groupStagesByPipeline } from "@/lib/stage-presentation";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { DealStageIndicator } from "./deal-stage";

type Stage = RouterOutputs["deals"]["list"]["rows"][number]["stage"];

const closeReasonParams = {
	closing: parseAsString,
	closingStage: parseAsString,
};

function useStageMutation(onDone?: () => void) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	return useMutation(
		trpc.deals.setStage.mutationOptions({
			onSuccess: async (_, variables) => {
				await cache.deal(variables.id);
				onDone?.();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
}

export function DealStageMenu({
	dealId,
	stage,
	variant = "inline",
}: {
	dealId: string;
	stage: Stage;
	variant?: "inline" | "control";
}) {
	const trpc = useTRPC();
	const [, setCloseParams] = useQueryStates(closeReasonParams);
	const setStage = useStageMutation();
	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: false }),
	);

	const groups = groupStagesByPipeline(pipelines.data ?? [], {
		activePipelineId: stage.pipelineId,
	});

	const choose = (target: Stage) => {
		if (target.id === stage.id) return;
		if (requiresReason(target)) {
			void setCloseParams({ closing: dealId, closingStage: target.id });
			return;
		}
		setStage.mutate({ id: dealId, stage: target.id });
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{variant === "control" ? (
					<Button
						variant="outline"
						size="sm"
						disabled={setStage.isPending}
						onClick={(event) => event.stopPropagation()}
					>
						<DealStageIndicator stage={stage} className="text-foreground" />
						<Icon icon={ChevronDown} className="text-muted-foreground" />
					</Button>
				) : (
					<button
						type="button"
						onClick={(event) => event.stopPropagation()}
						disabled={setStage.isPending}
						className="flex min-w-0 items-center text-left hover:text-foreground disabled:opacity-50"
					>
						<DealStageIndicator stage={stage} />
					</button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={variant === "control" ? "end" : "start"}
				className="min-w-52"
				onClick={(event) => event.stopPropagation()}
			>
				<DropdownMenuRadioGroup value={stage.id}>
					{groups.map((group) => (
						<DropdownMenuGroup key={group.pipelineId}>
							{groups.length > 1 ? (
								<DropdownMenuLabel>{group.pipelineName}</DropdownMenuLabel>
							) : null}
							{group.stages.map((candidate) =>
								candidate.pipelineId === stage.pipelineId ? (
									<DropdownMenuRadioItem
										key={candidate.id}
										value={candidate.id}
										onSelect={() => choose(candidate)}
									>
										{candidate.label}
									</DropdownMenuRadioItem>
								) : (
									<DropdownMenuSub key={candidate.id}>
										<DropdownMenuSubTrigger>
											{candidate.label}
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent>
											<DropdownMenuItem onSelect={() => choose(candidate)}>
												Move to {group.pipelineName}?
											</DropdownMenuItem>
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								),
							)}
						</DropdownMenuGroup>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function CloseReasonDialog() {
	const trpc = useTRPC();
	const reasonId = useId();
	const [{ closing, closingStage }, setCloseParams] =
		useQueryStates(closeReasonParams);
	const [reason, setReason] = useState("");
	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: false }),
	);

	const close = () => {
		setReason("");
		void setCloseParams({ closing: null, closingStage: null });
	};

	const setStage = useStageMutation(() => {
		toast.success("Deal closed.");
		close();
	});

	const stage = closingStage
		? findStageById(pipelines.data ?? [], closingStage)
		: undefined;
	const open = Boolean(closing && stage);
	const lost = stage?.outcome === "LOST";

	return (
		<Dialog open={open} onOpenChange={(next) => !next && close()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{stage
							? lost
								? `Close as ${stage.label}`
								: `Mark as ${stage.label}`
							: ""}
					</DialogTitle>
					<DialogDescription>
						{lost
							? "What did we lose it to? This is the only place that answer gets recorded."
							: "Why is this not a fit? It goes on the timeline so nobody re-runs the same deal."}
					</DialogDescription>
				</DialogHeader>

				<form
					id="close-reason"
					className="px-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!closing || !stage) return;
						setStage.mutate({
							id: closing,
							stage: stage.id,
							closedReason: reason,
						});
					}}
				>
					<Field>
						<FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
						<Textarea
							id={reasonId}
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Went with an incumbent vendor"
							rows={3}
						/>
					</Field>
				</form>

				<DialogFooter>
					<Button
						type="submit"
						form="close-reason"
						disabled={setStage.isPending || reason.trim() === ""}
					>
						{setStage.isPending ? <Spinner /> : null}
						Save
					</Button>
					<Button variant="outline" onClick={close}>
						Cancel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
