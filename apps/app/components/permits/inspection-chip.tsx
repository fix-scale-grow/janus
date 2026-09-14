"use client";

import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import { Icon } from "@crm/ui/components/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";

export type InspectionChipResult = "PENDING" | "PASSED" | "FAILED";

export type InspectionChipData = {
	id: string;
	name: string;
	result: InspectionChipResult;
	criticalNote: string | null;
};

export const INSPECTION_CHIP_CLASSES =
	"pointer-events-auto flex h-5 w-full items-center gap-1 truncate rounded-sm border px-1 text-left text-xs touch-none select-none";

const RESULT_CLASSES: Record<InspectionChipResult, string> = {
	PENDING: "border-border bg-background text-foreground",
	PASSED: "border-transparent bg-secondary text-secondary-foreground",
	FAILED: "border-transparent bg-destructive/10 text-destructive",
};

export function InspectionChip({
	inspection,
	dealId,
}: {
	inspection: InspectionChipData;
	dealId: string;
}) {
	const openRecord = useOpenRecord();
	const critical = inspection.criticalNote;

	const chip = (
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation();
				openRecord({ kind: "deal", id: dealId }, { tab: "permits" });
			}}
			className={cn(
				INSPECTION_CHIP_CLASSES,
				RESULT_CLASSES[inspection.result],
				critical && "ring-1 ring-warning/60",
			)}
		>
			{critical ? (
				<Icon icon={WarningAlt} className="size-3 shrink-0 text-warning" />
			) : null}
			<span className="truncate">{inspection.name}</span>
		</button>
	);

	if (!critical) return chip;

	return (
		<Tooltip>
			<TooltipTrigger asChild>{chip}</TooltipTrigger>
			<TooltipContent>{critical}</TooltipContent>
		</Tooltip>
	);
}
