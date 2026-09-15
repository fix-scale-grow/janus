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
import type { AuthedTrpcContext } from "../trpc/context.types";
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
	async forEstimate(@Input("estimateId") estimateId: string) {
		return this.proposals.forEstimate(estimateId);
	}

	@Query({ meta: access("estimates", "VIEW") })
	async mailerConfigured() {
		return this.proposals.mailerConfigured();
	}

	@Mutation({ input: proposalCreateInput, meta: access("estimates", "EDIT") })
	async createFromEstimate(
		@Input("estimateId") estimateId: string,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.proposals.createFromEstimate(estimateId, ctx.user.id);
	}

	@Mutation({ input: proposalUpdateInput, meta: access("estimates", "EDIT") })
	async update(@Input() input: z.infer<typeof proposalUpdateInput>) {
		return this.proposals.update(input);
	}

	@Mutation({ input: proposalSendInput, meta: access("estimates", "EDIT") })
	async send(
		@Input() input: z.infer<typeof proposalSendInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.proposals.send(input, ctx.user.name);
	}

	@Mutation({ input: proposalIdInput, meta: access("estimates", "EDIT") })
	async void(@Input("id") id: string) {
		return this.proposals.void(id);
	}

	@Mutation({ input: proposalIdInput, meta: access("estimates", "EDIT") })
	async revise(@Input("id") id: string, @Ctx() ctx: AuthedTrpcContext) {
		return this.proposals.revise(id, ctx.user.id);
	}

	@Query({ input: proposalIdInput, meta: access("estimates", "VIEW") })
	async document(@Input("id") id: string) {
		return this.proposals.document(id);
	}
}
