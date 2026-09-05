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
	estimateAddLineItemInput,
	estimateCreateInput,
	estimateGenerateFromDrawingInput,
	estimateIdInput,
	estimateLineItemIdInput,
	estimateListInput,
	estimateRenameInput,
	estimateSetStatusInput,
	estimateSetTierInput,
	estimateUpdateLineItemInput,
} from "./estimates.contracts";
import { EstimatesService } from "./estimates.service";

@Router({ alias: "estimates" })
@UseMiddlewares(AuthMiddleware)
export class EstimatesRouter {
	constructor(
		@Inject(EstimatesService) private readonly estimates: EstimatesService,
	) {}

	@Query({ input: estimateListInput })
	async list(@Input() input: z.infer<typeof estimateListInput>) {
		return this.estimates.list(input);
	}

	@Query({ input: estimateIdInput })
	async byId(@Input("id") id: string) {
		return this.estimates.byId(id);
	}

	@Mutation({ input: estimateCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof estimateCreateInput>,
	) {
		return this.estimates.create(input, ctx.user.id);
	}

	@Mutation({ input: estimateRenameInput })
	async rename(@Input() input: z.infer<typeof estimateRenameInput>) {
		return this.estimates.rename(input);
	}

	@Mutation({ input: estimateSetStatusInput })
	async setStatus(@Input() input: z.infer<typeof estimateSetStatusInput>) {
		return this.estimates.setStatus(input);
	}

	@Mutation({ input: estimateSetTierInput })
	async setTier(@Input() input: z.infer<typeof estimateSetTierInput>) {
		return this.estimates.setTier(input);
	}

	@Mutation({ input: estimateIdInput })
	async delete(@Input("id") id: string) {
		return this.estimates.delete(id);
	}

	@Mutation({ input: estimateAddLineItemInput })
	async addLineItem(@Input() input: z.infer<typeof estimateAddLineItemInput>) {
		return this.estimates.addLineItem(input);
	}

	@Mutation({ input: estimateUpdateLineItemInput })
	async updateLineItem(
		@Input() input: z.infer<typeof estimateUpdateLineItemInput>,
	) {
		return this.estimates.updateLineItem(input);
	}

	@Mutation({ input: estimateLineItemIdInput })
	async removeLineItem(@Input("id") id: string) {
		return this.estimates.removeLineItem(id);
	}

	@Mutation({ input: estimateGenerateFromDrawingInput })
	async generateFromDrawing(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof estimateGenerateFromDrawingInput>,
	) {
		return this.estimates.generateFromDrawing(input, ctx.user.id);
	}

	@Mutation({ input: estimateIdInput })
	async resyncFromDrawing(@Input("id") id: string) {
		return this.estimates.resyncFromDrawing(id);
	}
}
