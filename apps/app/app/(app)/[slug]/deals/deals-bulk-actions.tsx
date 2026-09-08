"use client";

import TrashCan from "@carbon/icons-react/es/TrashCan";
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
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	BulkOwnerMenu,
	reportBulk,
} from "@/components/crm/bulk-actions";
import { findStageById, groupStagesByPipeline } from "@/lib/stage-presentation";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function deals(count: number): string {
	return formatCount(count, "deal");
}

export function DealsBulkActions({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const users = useQuery(trpc.users.list.queryOptions());
	const pipelines = useQuery(
		trpc.pipelines.list.queryOptions({ includeArchived: false }),
	);
	const reasonId = useId();
	const [confirming, setConfirming] = useState(false);
	const [closingStageId, setClosingStageId] = useState<string | null>(null);
	const [reason, setReason] = useState("");

	const onError = (error: { message: string }) => toast.error(error.message);

	const assignOwner = useMutation(
		trpc.deals.bulkAssignOwner.mutationOptions({
			onSuccess: async (result) => {
				await cache.deal();
				reportBulk(result, (count) => `${deals(count)} reassigned.`);
				onDone();
			},
			onError,
		}),
	);

	const setStage = useMutation(
		trpc.deals.bulkSetStage.mutationOptions({
			onSuccess: async (result) => {
				await cache.deal();
				reportBulk(result, (count) => `${deals(count)} moved.`);
				setClosingStageId(null);
				setReason("");
				onDone();
			},
			onError,
		}),
	);

	const remove = useMutation(
		trpc.deals.bulkDelete.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "deal", ids: variables.ids });
				reportBulk(result, (count) => `${deals(count)} deleted.`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	const pending =
		assignOwner.isPending || setStage.isPending || remove.isPending;

	const groups = groupStagesByPipeline(pipelines.data ?? []);
	const closingStage = closingStageId
		? findStageById(pipelines.data ?? [], closingStageId)
		: undefined;
	const lost = closingStage?.outcome === "LOST";

	return (
		<>
			<BulkActionsMenu pending={pending}>
				<BulkOwnerMenu
					users={users.data ?? []}
					onSelect={(ownerId) =>
						ownerId && assignOwner.mutate({ ids, ownerId })
					}
				/>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>Change stage</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="max-h-72 overflow-y-auto">
						{groups.map((group) => (
							<DropdownMenuGroup key={group.pipelineId}>
								{groups.length > 1 ? (
									<DropdownMenuLabel>{group.pipelineName}</DropdownMenuLabel>
								) : null}
								{group.stages.map((stage) => (
									<DropdownMenuItem
										key={stage.id}
										onSelect={() => {
											if (requiresReason(stage)) {
												setClosingStageId(stage.id);
												return;
											}
											setStage.mutate({ ids, stage: stage.id });
										}}
									>
										{stage.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						variant="destructive"
						onSelect={() => setConfirming(true)}
					>
						<TrashCan />
						Delete
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</BulkActionsMenu>

			<Dialog
				open={closingStageId !== null}
				onOpenChange={(next) => {
					if (next) return;
					setClosingStageId(null);
					setReason("");
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{closingStage
								? lost
									? `Close ${deals(ids.length)} as ${closingStage.label}`
									: `Mark ${deals(ids.length)} as ${closingStage.label}`
								: ""}
						</DialogTitle>
						<DialogDescription>
							The same reason goes on every one of them, so keep it to what they
							have in common.
						</DialogDescription>
					</DialogHeader>

					<form
						id="bulk-close-reason"
						className="px-4"
						onSubmit={(event) => {
							event.preventDefault();
							if (!closingStageId) return;
							setStage.mutate({
								ids,
								stage: closingStageId,
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
								placeholder="Budget pulled for the quarter"
								rows={3}
							/>
						</Field>
					</form>

					<DialogFooter>
						<Button
							type="submit"
							form="bulk-close-reason"
							disabled={setStage.isPending || reason.trim() === ""}
						>
							{setStage.isPending ? <Spinner /> : null}
							Save
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								setClosingStageId(null);
								setReason("");
							}}
						>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<BulkDeleteDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={`Delete ${deals(ids.length)}?`}
				description="Everything filed against them — activity, notes, the amounts in your pipeline — goes too. This cannot be undone."
				onConfirm={() => remove.mutate({ ids })}
			/>
		</>
	);
}
