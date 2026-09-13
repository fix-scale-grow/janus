"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRecordSheetView } from "@/components/crm/record-sheet/record-stack";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useSubmitGuard } from "@/lib/use-submit-guard";

export function aiFillMessage(permitId: string): string {
	return `Fill the permit worksheet for permit ${permitId} using this job's records.`;
}

export function FillModeDialog({
	permitId,
	open,
	onOpenChange,
	onGuidedFilled,
}: {
	permitId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onGuidedFilled: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const guard = useSubmitGuard();
	const { openAgent } = useRecordSheetView("overview");

	const applyPrefills = useMutation(
		trpc.permits.applyPrefills.mutationOptions({
			onSuccess: () => cache.permit(permitId, { settle: "record" }),
			onError: (error: { message: string }) => toast.error(error.message),
			onSettled: () => guard.release(),
		}),
	);

	const runAiFill = () =>
		guard.guard(() => {
			applyPrefills.mutate(
				{ permitId },
				{
					onSuccess: () => {
						openAgent(aiFillMessage(permitId));
						onOpenChange(false);
					},
				},
			);
		});

	const runGuidedFill = () =>
		guard.guard(() => {
			applyPrefills.mutate(
				{ permitId },
				{
					onSuccess: () => {
						onOpenChange(false);
						onGuidedFilled();
					},
				},
			);
		});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Fill this worksheet</DialogTitle>
					<DialogDescription>
						Pull in what the job already knows, then decide who checks it.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3 sm:grid-cols-2">
					<button
						type="button"
						disabled={applyPrefills.isPending}
						onClick={runAiFill}
						className="flex flex-col gap-1 rounded-lg border p-3 text-left hover:border-ring/40 disabled:pointer-events-none disabled:opacity-60"
					>
						<span className="font-medium text-sm">AI fill</span>
						<span className="text-muted-foreground text-xs">
							Janus drafts the answers and asks about the rest.
						</span>
					</button>
					<button
						type="button"
						disabled={applyPrefills.isPending}
						onClick={runGuidedFill}
						className="flex flex-col gap-1 rounded-lg border p-3 text-left hover:border-ring/40 disabled:pointer-events-none disabled:opacity-60"
					>
						<span className="font-medium text-sm">Guided fill</span>
						<span className="text-muted-foreground text-xs">
							Pull in what the job already knows. You fill the rest.
						</span>
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
