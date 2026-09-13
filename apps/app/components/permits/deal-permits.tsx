"use client";

import Add from "@carbon/icons-react/es/Add";
import Certificate from "@carbon/icons-react/es/Certificate";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { useTRPC } from "@/lib/trpc/client";
import { useSubmitGuard } from "@/lib/use-submit-guard";
import { NewPermitDialog } from "./new-permit-dialog";
import { PermitCard } from "./permit-card";
import { PermitPromptBanner } from "./permit-prompt-banner";

export function DealPermits({ dealId }: { dealId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const dismissGuard = useSubmitGuard();
	const [dialogOpen, setDialogOpen] = useState(false);

	const permits = useQuery(trpc.permits.listByDeal.queryOptions({ dealId }));
	const prompt = useQuery(trpc.permits.promptState.queryOptions({ dealId }));

	const dismiss = useMutation(
		trpc.permits.dismissPrompt.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.permits.promptState.queryKey({ dealId }),
				}),
			onError: (error: { message: string }) => toast.error(error.message),
			onSettled: () => dismissGuard.release(),
		}),
	);

	const rows = (permits.data ?? []) as unknown as { id: string }[];

	return (
		<DetailSheetBody>
			{prompt.data?.show ? (
				<PermitPromptBanner
					jurisdictionGuess={prompt.data.jurisdictionGuess}
					neededWhen={prompt.data.neededWhen}
					onOpenPermit={() => setDialogOpen(true)}
					onDismiss={() => dismissGuard.guard(() => dismiss.mutate({ dealId }))}
					dismissing={dismiss.isPending}
				/>
			) : null}

			<DetailSheetSection
				title="Permits"
				action={
					<Button size="sm" onClick={() => setDialogOpen(true)}>
						<Icon icon={Add} data-icon="inline-start" />
						Open a permit
					</Button>
				}
			>
				{rows.length === 0 ? (
					<DetailSheetEmpty
						icon={Certificate}
						title="No permits yet"
						description="Open a permit once this job needs one pulled."
					/>
				) : (
					<div className="flex flex-col gap-4">
						{rows.map((permit) => (
							<PermitCard key={permit.id} permitId={permit.id} />
						))}
					</div>
				)}
			</DetailSheetSection>

			<NewPermitDialog
				dealId={dealId}
				jurisdictionGuess={prompt.data?.jurisdictionGuess ?? null}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</DetailSheetBody>
	);
}
