import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import { anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { AgentDefinitionsService } from "./agent-definitions.service";
import { AgentRunsService } from "./agent-runs.service";
import {
	agentCancelRunInput,
	agentDeployInput,
	agentHistoryInput,
	agentIdInput,
	agentRetryRunInput,
	agentReviseInput,
	agentRunNowInput,
	agentSaveFileInput,
	agentUpdateInput,
} from "./agents.contracts";

@Router({ alias: "agents" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class AgentsRouter {
	constructor(
		@Inject(AgentDefinitionsService)
		private readonly agents: AgentDefinitionsService,
		@Inject(AgentRunsService)
		private readonly runs: AgentRunsService,
	) {}

	@Query({ meta: anyMember() })
	async list(@Ctx() ctx: AuthedTrpcContext) {
		return this.agents.list(ctx.user.id);
	}

	@Mutation({ input: agentReviseInput, meta: anyMember() })
	async revise(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentReviseInput>,
	) {
		return this.agents.revise(input, ctx.user.id);
	}

	@Query({ input: agentIdInput, meta: anyMember() })
	async files(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.agents.files(id, ctx.user.id);
	}

	@Mutation({ input: agentSaveFileInput, meta: anyMember() })
	async saveFile(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentSaveFileInput>,
	) {
		return this.agents.saveFile(input, ctx.user.id);
	}

	@Query({ input: agentIdInput, meta: anyMember() })
	async byId(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.agents.byId(id, ctx.user.id);
	}

	@Query({ input: agentHistoryInput, meta: anyMember() })
	async history(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentHistoryInput>,
	) {
		return this.runs.list(input.id, input.limit, ctx.user.id);
	}

	@Query({ input: agentHistoryInput, meta: anyMember() })
	async activity(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentHistoryInput>,
	) {
		return this.runs.activity(input.id, input.limit, ctx.user.id);
	}

	@Mutation({ input: agentUpdateInput, meta: anyMember() })
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentUpdateInput>,
	) {
		return this.agents.update(input, ctx.user.id);
	}

	@Mutation({ input: agentDeployInput, meta: anyMember() })
	async deploy(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentDeployInput>,
	) {
		return this.agents.deploy(input, ctx.user.id);
	}

	@Mutation({ input: agentIdInput, meta: anyMember() })
	async pause(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.agents.pause(id, ctx.user.id);
	}

	@Mutation({ input: agentIdInput, meta: anyMember() })
	async resume(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.agents.resume(id, ctx.user.id);
	}

	@Mutation({ input: agentIdInput, meta: anyMember() })
	async archive(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.agents.archive(id, ctx.user.id);
	}

	@Mutation({ input: agentIdInput, meta: anyMember() })
	async restore(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.agents.restore(id, ctx.user.id);
	}

	@Mutation({ input: agentIdInput, meta: anyMember() })
	async remove(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.agents.remove(id, ctx.user.id);
	}

	@Mutation({ input: agentRunNowInput, meta: anyMember() })
	async runNow(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentRunNowInput>,
	) {
		return this.runs.runNow(input, ctx.user.id);
	}

	@Mutation({ input: agentRetryRunInput, meta: anyMember() })
	async retryRun(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentRetryRunInput>,
	) {
		return this.runs.retryRun(input, ctx.user.id);
	}

	@Mutation({ input: agentCancelRunInput, meta: anyMember() })
	async cancelRun(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof agentCancelRunInput>,
	) {
		return this.runs.cancelRun(input, ctx.user.id);
	}
}
