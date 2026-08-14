"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import type { ProductionStage } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	PRODUCTION_STAGE_OPTIONS,
	productionStageColor,
	productionStageLabel,
	UNSCHEDULED,
} from "@/lib/production-stage";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

// `UNSCHEDULED` doubles as the radio value for the null (not-yet-scheduled)
// production state — it can never collide with a real `ProductionStage` value.
const UNSCHEDULED_VALUE: string = UNSCHEDULED;

export function ProductionStageIndicator({
	stage,
}: {
	stage: ProductionStage | null;
}) {
	return (
		<span className="flex min-w-0 items-center gap-2 text-sm">
			<span
				className="h-2.5 w-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: productionStageColor(stage ?? UNSCHEDULED) }}
			/>
			<span className="truncate text-foreground">
				{stage ? productionStageLabel(stage) : "Unscheduled"}
			</span>
		</span>
	);
}

/**
 * Won-job production-stage control for the deal record sheet — the sheet-side
 * counterpart to the Production board's drag-drop. Mirrors `DealStageMenu` but
 * drives `deals.setProductionStage` (which is guarded to `CLOSED_WON` deals in
 * the service). Choosing "Unscheduled" clears the stage (`null`), matching the
 * board's Unscheduled intake column.
 */
export function ProductionStageMenu({
	dealId,
	stage,
}: {
	dealId: string;
	stage: ProductionStage | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const setStage = useMutation(
		trpc.deals.setProductionStage.mutationOptions({
			onSuccess: async (_, variables) => {
				await cache.deal(variables.id);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const current = stage ?? UNSCHEDULED_VALUE;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					disabled={setStage.isPending}
					onClick={(event) => event.stopPropagation()}
				>
					<ProductionStageIndicator stage={stage} />
					<Icon icon={ChevronDown} className="text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="min-w-52"
				onClick={(event) => event.stopPropagation()}
			>
				<DropdownMenuRadioGroup
					value={current}
					onValueChange={(next) => {
						if (next === current) return;
						const nextStage =
							next === UNSCHEDULED_VALUE ? null : (next as ProductionStage);
						setStage.mutate({ id: dealId, stage: nextStage });
					}}
				>
					<DropdownMenuRadioItem value={UNSCHEDULED_VALUE}>
						Unscheduled
					</DropdownMenuRadioItem>
					{PRODUCTION_STAGE_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
