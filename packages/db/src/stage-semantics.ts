import { StageOutcome } from "./generated/prisma/enums";

export type StageLike = {
	outcome: StageOutcome;
};

export type EntryStageLike = StageLike & {
	isEntry: boolean;
	archivedAt: Date | null;
};

export function isClosedStage(stage: StageLike): boolean {
	return stage.outcome !== StageOutcome.OPEN;
}

export function requiresReason(stage: StageLike): boolean {
	return (
		stage.outcome === StageOutcome.LOST ||
		stage.outcome === StageOutcome.DISQUALIFIED
	);
}

export function isWonStage(stage: StageLike): boolean {
	return stage.outcome === StageOutcome.WON;
}

export function entryStageOf<T extends EntryStageLike>(
	stages: readonly T[],
): T | undefined {
	return stages.find((stage) => stage.isEntry && !stage.archivedAt);
}

export const STAGE_SWATCHES = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--swatch-1)",
	"var(--swatch-2)",
	"var(--swatch-3)",
	"var(--swatch-4)",
	"var(--swatch-5)",
	"var(--swatch-6)",
	"var(--swatch-7)",
] as const;
