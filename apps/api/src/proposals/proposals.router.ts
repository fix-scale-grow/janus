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
import { access } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	proposalCreateInput,
	proposalForEstimateInput,
	proposalIdInput,
	proposalSendInput,
	proposalUpdateInput,
} from "./proposals.contracts";
import { ProposalsService } from "./proposals.service";

@Router({ alias: "proposals" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ProposalsRouter {
	constructor(
		@Inject(ProposalsService) private readonly proposals: ProposalsService,
	) {}

	@Query({ input: proposalForEstimateInput, meta: access("estimates", "VIEW") })
	async forEstimate(
		@Input("estimateId") estimateId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.proposals.forEstimate(estimateId, ctx.access);
	}

	@Query({ meta: access("estimates", "VIEW") })
	async mailerConfigured() {
		return this.proposals.mailerConfigured();
	}

	@Mutation({ input: proposalCreateInput, meta: access("estimates", "EDIT") })
	async createFromEstimate(
		@Input("estimateId") estimateId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.proposals.createFromEstimate(
			estimateId,
			ctx.user.id,
			ctx.access,
		);
	}

	@Mutation({ input: proposalUpdateInput, meta: access("estimates", "EDIT") })
	async update(
		@Input() input: z.infer<typeof proposalUpdateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.proposals.update(input, ctx.access);
	}

	@Mutation({ input: proposalSendInput, meta: access("estimates", "EDIT") })
	async send(
		@Input() input: z.infer<typeof proposalSendInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.proposals.send(input, ctx.user.name, ctx.access);
	}

	@Mutation({ input: proposalIdInput, meta: access("estimates", "EDIT") })
	async void(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.proposals.void(id, ctx.access);
	}

	@Mutation({ input: proposalIdInput, meta: access("estimates", "EDIT") })
	async revise(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.proposals.revise(id, ctx.user.id, ctx.access);
	}

	@Query({ input: proposalIdInput, meta: access("estimates", "VIEW") })
	async document(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.proposals.document(id, ctx.access);
	}
}
