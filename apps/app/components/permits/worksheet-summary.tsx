"use client";

import { Button } from "@crm/ui/components/button";
import { useState } from "react";
import type { RouterOutputs } from "@/lib/trpc/types";
import { FillModeDialog } from "./fill-mode-dialog";
import { WorksheetPanel } from "./worksheet-panel";

type Permit = RouterOutputs["permits"]["byId"];

export function WorksheetSummary({ permit }: { permit: Permit }) {
	const [fillOpen, setFillOpen] = useState(false);
	const [panelOpen, setPanelOpen] = useState(false);

	if (permit.worksheetTemplate.length === 0) return null;

	const approvedCount = Object.values(permit.worksheetAnswers).filter(
		(answer) => answer.value !== "" && answer.state === "APPROVED",
	).length;
	const totalCount = permit.worksheetTemplate.length;
	const hasAnswers = Object.keys(permit.worksheetAnswers).length > 0;

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
			<div className="flex flex-col gap-0.5">
				<span className="font-medium text-sm">Worksheet</span>
				<span className="text-muted-foreground text-xs">
					{approvedCount} of {totalCount} approved
				</span>
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => (hasAnswers ? setPanelOpen(true) : setFillOpen(true))}
			>
				Open worksheet
			</Button>

			<FillModeDialog
				permitId={permit.id}
				open={fillOpen}
				onOpenChange={setFillOpen}
				onGuidedFilled={() => setPanelOpen(true)}
			/>

			<WorksheetPanel
				permit={permit}
				open={panelOpen}
				onOpenChange={setPanelOpen}
			/>
		</div>
	);
}
