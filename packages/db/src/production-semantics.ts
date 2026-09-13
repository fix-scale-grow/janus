import { ProductionStage } from "./generated/prisma/enums";

export type AutoProductionStage = Exclude<
	ProductionStage,
	typeof ProductionStage.ON_HOLD
>;

const AUTO_RANK: Record<AutoProductionStage, number> = {
	[ProductionStage.SCHEDULED]: 1,
	[ProductionStage.IN_PROGRESS]: 2,
	[ProductionStage.COMPLETE]: 3,
	[ProductionStage.PAID]: 4,
};

function rankOf(stage: ProductionStage | null): number {
	if (stage === null) return 0;
	if (stage === ProductionStage.ON_HOLD) return Number.POSITIVE_INFINITY;
	return AUTO_RANK[stage];
}

export function canAutoAdvance(
	current: ProductionStage | null,
	target: AutoProductionStage,
): boolean {
	if (current === ProductionStage.ON_HOLD) return false;
	return AUTO_RANK[target] > rankOf(current);
}
