"use client";

import Add from "@carbon/icons-react/es/Add";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Inspection = RouterOutputs["permits"]["byId"]["inspections"][number];
type InspectionResult = Inspection["result"];

const RESULT_CYCLE: Record<InspectionResult, InspectionResult> = {
	PENDING: "PASSED",
	PASSED: "FAILED",
	FAILED: "PENDING",
};

const RESULT_LABEL: Record<InspectionResult, string> = {
	PENDING: "Pending",
	PASSED: "Passed",
	FAILED: "Failed",
};

const RESULT_VARIANT: Record<
	InspectionResult,
	"secondary" | "outline" | "destructive"
> = {
	PENDING: "outline",
	PASSED: "secondary",
	FAILED: "destructive",
};

export function InspectionsSection({
	permitId,
	inspections,
}: {
	permitId: string;
	inspections: Inspection[];
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState("");

	const setInspection = useMutation(
		trpc.permits.setInspection.mutationOptions({
			onSuccess: () => cache.permit(permitId, { settle: "record" }),
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const deleteInspection = useMutation(
		trpc.permits.deleteInspection.mutationOptions({
			onSuccess: () => cache.permit(permitId, { settle: "record" }),
			onError: (error: { message: string }) => toast.error(error.message),
		}),
	);

	const addInspection = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		setInspection.mutate({ permitId, name: trimmed });
		setName("");
		setAdding(false);
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<h3 className="font-medium text-muted-foreground text-sm">
					Inspections
				</h3>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setAdding(true)}
				>
					<Icon icon={Add} data-icon="inline-start" />
					Add inspection
				</Button>
			</div>

			<div className="flex flex-col gap-1.5">
				{inspections.map((inspection) => (
					<div
						key={inspection.id}
						className="flex flex-col gap-1 rounded-lg border p-2.5"
					>
						<div className="flex flex-wrap items-center gap-2">
							<span className="min-w-0 flex-1 truncate text-sm">
								{inspection.name}
							</span>
							<DatePicker
								value={inspection.scheduledFor?.slice(0, 10) ?? null}
								placeholder="Schedule"
								onChange={(next) =>
									setInspection.mutate({
										permitId,
										inspectionId: inspection.id,
										name: inspection.name,
										scheduledFor: next ? new Date(next) : null,
									})
								}
							/>
							<button
								type="button"
								onClick={() =>
									setInspection.mutate({
										permitId,
										inspectionId: inspection.id,
										name: inspection.name,
										result: RESULT_CYCLE[inspection.result],
									})
								}
							>
								<Badge variant={RESULT_VARIANT[inspection.result]}>
									{RESULT_LABEL[inspection.result]}
								</Badge>
							</button>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								disabled={deleteInspection.isPending}
								onClick={() =>
									deleteInspection.mutate({ inspectionId: inspection.id })
								}
							>
								<Icon icon={TrashCan} />
								<span className="sr-only">Delete {inspection.name}</span>
							</Button>
						</div>
						{inspection.criticalNote ? (
							<p className="flex items-center gap-1.5 text-warning text-xs">
								<Icon icon={WarningAlt} className="size-3.5" />
								{inspection.criticalNote}
							</p>
						) : null}
					</div>
				))}

				{adding ? (
					<div className="flex items-center gap-2 rounded-lg border p-2.5">
						<Input
							autoFocus
							value={name}
							placeholder="Inspection name"
							onChange={(event) => setName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									addInspection();
								}
								if (event.key === "Escape") {
									setName("");
									setAdding(false);
								}
							}}
						/>
						<Button type="button" size="sm" onClick={addInspection}>
							Add
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}
