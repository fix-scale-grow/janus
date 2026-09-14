"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Skeleton } from "@crm/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { InlineDateField, InlineField } from "@/components/crm/inline-field";
import { PERMIT_TYPE_LABEL } from "@/lib/permits/permit-status";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { ChecklistSection } from "./checklist-section";
import { InspectionsSection } from "./inspections-section";
import { PermitStatusBadge } from "./permit-status-badge";
import { PermitStatusControl } from "./permit-status-control";
import { WorksheetSummary } from "./worksheet-summary";

export function PermitCard({ permitId }: { permitId: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const query = useQuery(trpc.permits.byId.queryOptions({ permitId }));

	const update = useMutation(
		trpc.permits.update.mutationOptions({
			onSuccess: () => cache.permit(permitId, { settle: "record" }),
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	if (query.isPending || !query.data) {
		return <Skeleton className="h-40 w-full rounded-lg" />;
	}

	const permit = query.data;
	const isSaving = (field: "permitNumber" | "feeCents" | "expiresAt") =>
		update.isPending && Boolean(update.variables && field in update.variables);

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle>
						{permit.typeLabel || PERMIT_TYPE_LABEL[permit.permitType]}
					</CardTitle>
					<PermitStatusBadge status={permit.status} />
				</div>
				<CardDescription>
					{permit.jurisdiction.name}, {permit.jurisdiction.state}
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				<div className="grid gap-3 sm:grid-cols-3">
					<InlineField
						label="Permit #"
						value={permit.permitNumber}
						placeholder="Not assigned"
						saving={isSaving("permitNumber")}
						onSave={(next) =>
							update.mutate({ permitId, permitNumber: next || null })
						}
					/>
					<InlineField
						label="Fee"
						value={
							permit.feeCents === null ? null : String(permit.feeCents / 100)
						}
						placeholder="0.00"
						saving={isSaving("feeCents")}
						onSave={(next) => {
							if (next === "") {
								update.mutate({ permitId, feeCents: null });
								return;
							}
							const parsed = Number.parseFloat(next);
							if (!Number.isFinite(parsed) || parsed < 0) {
								toast.error("Fee has to be a number, zero or more.");
								return;
							}
							update.mutate({ permitId, feeCents: Math.round(parsed * 100) });
						}}
						render={(value) => `$${Number(value).toFixed(2)}`}
					/>
					<InlineDateField
						label="Expires"
						value={permit.expiresAt}
						saving={isSaving("expiresAt")}
						onSave={(next) =>
							update.mutate({
								permitId,
								expiresAt: next ? new Date(next) : null,
							})
						}
					/>
				</div>

				{permit.status === "DENIED" && permit.deniedReason ? (
					<p className="text-destructive text-sm">{permit.deniedReason}</p>
				) : null}

				<PermitStatusControl permit={permit} />

				<ChecklistSection permitId={permitId} documents={permit.documents} />

				<InspectionsSection
					permitId={permitId}
					inspections={permit.inspections}
				/>

				<WorksheetSummary permit={permit} />
			</CardContent>
		</Card>
	);
}
