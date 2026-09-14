"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	PERMIT_STATUS_LABEL,
	permitTransitions,
} from "@/lib/permits/permit-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useSubmitGuard } from "@/lib/use-submit-guard";

type Permit = RouterOutputs["permits"]["byId"];

export function PermitStatusControl({ permit }: { permit: Permit }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const guard = useSubmitGuard();
	const reasonId = useId();
	const [denyOpen, setDenyOpen] = useState(false);
	const [deniedReason, setDeniedReason] = useState("");

	const setStatus = useMutation(
		trpc.permits.setStatus.mutationOptions({
			onSuccess: () => cache.permit(permit.id, { settle: "record" }),
			onError: (error: { message: string }) => toast.error(error.message),
			onSettled: () => guard.release(),
		}),
	);

	const nextStatuses = permitTransitions(permit.status);
	const hasUnpassedInspection = permit.inspections.some(
		(inspection) => inspection.result !== "PASSED",
	);

	const move = (status: (typeof nextStatuses)[number]) => {
		if (status === "DENIED") {
			setDeniedReason("");
			setDenyOpen(true);
			return;
		}
		guard.guard(() => setStatus.mutate({ permitId: permit.id, status }));
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			{nextStatuses.map((status) => {
				const disabled = status === "CLOSED" && hasUnpassedInspection;
				const button = (
					<Button
						key={status}
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || setStatus.isPending}
						onClick={() => move(status)}
					>
						{PERMIT_STATUS_LABEL[status]}
					</Button>
				);
				if (!disabled) return button;
				return (
					<Tooltip key={status}>
						<TooltipTrigger asChild>
							<span>{button}</span>
						</TooltipTrigger>
						<TooltipContent>Every inspection must pass first.</TooltipContent>
					</Tooltip>
				);
			})}

			<Dialog open={denyOpen} onOpenChange={setDenyOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Deny this permit</DialogTitle>
						<DialogDescription>Say why it was denied.</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
						<Textarea
							id={reasonId}
							autoFocus
							value={deniedReason}
							onChange={(event) => setDeniedReason(event.target.value)}
						/>
					</Field>
					<DialogFooter>
						<Button
							type="button"
							variant="destructive"
							disabled={deniedReason.trim() === "" || setStatus.isPending}
							onClick={() =>
								guard.guard(() =>
									setStatus.mutate(
										{
											permitId: permit.id,
											status: "DENIED",
											deniedReason: deniedReason.trim(),
										},
										{ onSuccess: () => setDenyOpen(false) },
									),
								)
							}
						>
							{setStatus.isPending ? (
								<Spinner data-icon="inline-start" />
							) : null}
							Deny permit
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
