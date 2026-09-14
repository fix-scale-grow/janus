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
@UseMiddlewares(AuthMiddleware)
export class ProposalsRouter {
	constructor(
		@Inject(ProposalsService) private readonly proposals: ProposalsService,
	) {}

	@Query({ input: proposalForEstimateInput })
	async forEstimate(@Input("estimateId") estimateId: string) {
		return this.proposals.forEstimate(estimateId);
	}

	@Query()
	async mailerConfigured() {
		return this.proposals.mailerConfigured();
	}

	@Mutation({ input: proposalCreateInput })
	async createFromEstimate(
		@Input("estimateId") estimateId: string,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.proposals.createFromEstimate(estimateId, ctx.user.id);
	}

	@Mutation({ input: proposalUpdateInput })
	async update(@Input() input: z.infer<typeof proposalUpdateInput>) {
		return this.proposals.update(input);
	}

	@Mutation({ input: proposalSendInput })
	async send(
		@Input() input: z.infer<typeof proposalSendInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.proposals.send(input, ctx.user.name);
	}

	@Mutation({ input: proposalIdInput })
	async void(@Input("id") id: string) {
		return this.proposals.void(id);
	}

	@Mutation({ input: proposalIdInput })
	async revise(@Input("id") id: string, @Ctx() ctx: AuthedTrpcContext) {
		return this.proposals.revise(id, ctx.user.id);
	}

	@Query({ input: proposalIdInput })
	async document(@Input("id") id: string) {
		return this.proposals.document(id);
	}
}
