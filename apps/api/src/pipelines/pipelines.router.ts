import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	pipelineCreateInput,
	pipelineIdInput,
	pipelineListInput,
	pipelineReorderInput,
	pipelineUpdateArgs,
	stageCreateInput,
	stageIdInput,
	stageReorderInput,
	stageUpdateArgs,
} from "./pipelines.contracts";
import { PipelinesService } from "./pipelines.service";

@Router({ alias: "pipelines" })
@UseMiddlewares(AuthMiddleware)
export class PipelinesRouter {
	constructor(
		@Inject(PipelinesService) private readonly pipelines: PipelinesService,
	) {}

	@Query({ input: pipelineListInput })
	async list(@Input() input: z.infer<typeof pipelineListInput>) {
		return this.pipelines.list(input.includeArchived);
	}

	@Query()
	async stageLabels() {
		return this.pipelines.stageLabels();
	}

	@Mutation({ input: pipelineCreateInput })
	async createPipeline(@Input() input: z.infer<typeof pipelineCreateInput>) {
		return this.pipelines.createPipeline(input.name);
	}

	@Mutation({ input: pipelineUpdateArgs })
	async updatePipeline(@Input() input: z.infer<typeof pipelineUpdateArgs>) {
		return this.pipelines.updatePipeline(input.id, input.data);
	}

	@Mutation({ input: pipelineReorderInput })
	async reorderPipelines(@Input() input: z.infer<typeof pipelineReorderInput>) {
		return this.pipelines.reorderPipelines(input);
	}

	@Mutation({ input: pipelineIdInput })
	async archivePipeline(@Input("id") id: string) {
		return this.pipelines.archivePipeline(id);
	}

	@Mutation({ input: pipelineIdInput })
	async restorePipeline(@Input("id") id: string) {
		return this.pipelines.restorePipeline(id);
	}

	@Mutation({ input: stageCreateInput })
	async createStage(@Input() input: z.infer<typeof stageCreateInput>) {
		return this.pipelines.createStage(input);
	}

	@Mutation({ input: stageUpdateArgs })
	async updateStage(@Input() input: z.infer<typeof stageUpdateArgs>) {
		return this.pipelines.updateStage(input.id, input.data);
	}

	@Mutation({ input: stageReorderInput })
	async reorderStages(@Input() input: z.infer<typeof stageReorderInput>) {
		return this.pipelines.reorderStages(input);
	}

	@Mutation({ input: stageIdInput })
	async archiveStage(@Input("id") id: string) {
		return this.pipelines.archiveStage(id);
	}

	@Mutation({ input: stageIdInput })
	async restoreStage(@Input("id") id: string) {
		return this.pipelines.restoreStage(id);
	}

	@Mutation({ input: stageIdInput })
	async deleteStage(@Input("id") id: string) {
		return this.pipelines.deleteStage(id);
	}
}
