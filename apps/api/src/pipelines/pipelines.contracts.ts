import { StageOutcome } from "@crm/db";
import { STAGE_SWATCHES } from "@crm/db/stage-semantics";
import { z } from "zod";

export const stageOutcome = z.enum(
	Object.values(StageOutcome) as [StageOutcome, ...StageOutcome[]],
);

export const stageColor = z
	.string()
	.refine(
		(value) => (STAGE_SWATCHES as readonly string[]).includes(value),
		"Pick a color from the curated set of stage colors.",
	);

export const pipelineListInput = z.object({
	includeArchived: z.boolean().default(false),
});

export type PipelineListInput = z.infer<typeof pipelineListInput>;

export const pipelineCreateInput = z.object({
	name: z.string().trim().min(1, "A pipeline needs a name."),
});

export type PipelineCreateInput = z.infer<typeof pipelineCreateInput>;

const pipelineUpdateData = z.object({
	name: z.string().trim().min(1).optional(),
});

export type PipelineUpdateData = z.infer<typeof pipelineUpdateData>;

export const pipelineUpdateArgs = z.object({
	id: z.string(),
	data: pipelineUpdateData,
});

export const pipelineIdInput = z.object({ id: z.string() });

export const pipelineReorderInput = z.object({
	ids: z.array(z.string()).min(1),
});

export type PipelineReorderInput = z.infer<typeof pipelineReorderInput>;

export const stageCreateInput = z.object({
	pipelineId: z.string(),
	label: z.string().trim().min(1, "A stage needs a label."),
	color: stageColor,
	outcome: stageOutcome,
	position: z.number().int().min(0).optional(),
});

export type StageCreateInput = z.infer<typeof stageCreateInput>;

const stageUpdateData = z.object({
	label: z.string().trim().min(1).optional(),
	color: stageColor.optional(),
	outcome: stageOutcome.optional(),
	isEntry: z.boolean().optional(),
});

export type StageUpdateData = z.infer<typeof stageUpdateData>;

export const stageUpdateArgs = z.object({
	id: z.string(),
	data: stageUpdateData,
});

export const stageIdInput = z.object({ id: z.string() });

export const stageReorderInput = z.object({
	pipelineId: z.string(),
	ids: z.array(z.string()).min(1),
});

export type StageReorderInput = z.infer<typeof stageReorderInput>;
