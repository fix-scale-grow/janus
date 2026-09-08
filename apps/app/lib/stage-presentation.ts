import type { StageOutcome } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

export type StagePresentation = {
	id: string;
	label: string;
	color: string;
	outcome: StageOutcome;
	pipelineId: string;
};

export type PipelineWithStages<
	TStage extends StagePresentation = StagePresentation,
> = {
	id: string;
	name: string;
	stages: TStage[];
};

export type StageGroup<TStage extends StagePresentation = StagePresentation> = {
	pipelineId: string;
	pipelineName: string;
	stages: TStage[];
};

export function stageColor(stage: StagePresentation): string {
	return stage.color;
}

export function stageToneFallback(outcome: StageOutcome): StatusTone {
	if (outcome === "WON") return "success";
	if (outcome === "LOST" || outcome === "DISQUALIFIED") return "error";
	return "neutral";
}

export function groupStagesByPipeline<TStage extends StagePresentation>(
	pipelines: readonly PipelineWithStages<TStage>[],
	options?: {
		activePipelineId?: string;
		filter?: (stage: TStage) => boolean;
	},
): StageGroup<TStage>[] {
	const groups = pipelines.flatMap((pipeline) => {
		const stages = options?.filter
			? pipeline.stages.filter(options.filter)
			: pipeline.stages;
		return stages.length > 0
			? [{ pipelineId: pipeline.id, pipelineName: pipeline.name, stages }]
			: [];
	});

	const activeIndex = options?.activePipelineId
		? groups.findIndex((group) => group.pipelineId === options.activePipelineId)
		: -1;

	if (activeIndex <= 0) return groups;

	const [active] = groups.splice(activeIndex, 1);
	return active ? [active, ...groups] : groups;
}

export function findStageById<TStage extends StagePresentation>(
	pipelines: readonly PipelineWithStages<TStage>[],
	stageId: string,
): TStage | undefined {
	for (const pipeline of pipelines) {
		const stage = pipeline.stages.find((candidate) => candidate.id === stageId);
		if (stage) return stage;
	}
	return undefined;
}
