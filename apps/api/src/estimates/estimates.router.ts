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
	estimateAddLineItemInput,
	estimateAssignContactInput,
	estimateCreateInput,
	estimateGenerateFromDrawingInput,
	estimateIdInput,
	estimateLineItemIdInput,
	estimateListInput,
	estimateRenameInput,
	estimateSendInput,
	estimateSetStatusInput,
	estimateSetTierInput,
	estimateUpdateLineItemInput,
	estimateUpdateTextInput,
} from "./estimates.contracts";
import { EstimatesService } from "./estimates.service";

@Router({ alias: "estimates" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class EstimatesRouter {
	constructor(
		@Inject(EstimatesService) private readonly estimates: EstimatesService,
	) {}

	@Query({ input: estimateListInput, meta: access("estimates", "VIEW") })
	async list(
		@Input() input: z.infer<typeof estimateListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.list(input, ctx.access);
	}

	@Query({ input: estimateIdInput, meta: access("estimates", "VIEW") })
	async byId(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.estimates.byId(id, ctx.access);
	}

	@Mutation({ input: estimateCreateInput, meta: access("estimates", "EDIT") })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof estimateCreateInput>,
	) {
		return this.estimates.create(input, ctx.access);
	}

	@Mutation({ input: estimateRenameInput, meta: access("estimates", "EDIT") })
	async rename(
		@Input() input: z.infer<typeof estimateRenameInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.rename(input, ctx.access);
	}

	@Mutation({
		input: estimateUpdateTextInput,
		meta: access("estimates", "EDIT"),
	})
	async updateText(
		@Input() input: z.infer<typeof estimateUpdateTextInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.updateText(input, ctx.access);
	}

	@Mutation({
		input: estimateSetStatusInput,
		meta: access("estimates", "EDIT"),
	})
	async setStatus(
		@Input() input: z.infer<typeof estimateSetStatusInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.setStatus(input, ctx.access);
	}

	@Mutation({ input: estimateSetTierInput, meta: access("estimates", "EDIT") })
	async setTier(
		@Input() input: z.infer<typeof estimateSetTierInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.setTier(input, ctx.access);
	}

	@Mutation({ input: estimateIdInput, meta: access("estimates", "DELETE") })
	async delete(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.estimates.delete(id, ctx.access);
	}

	@Mutation({
		input: estimateAddLineItemInput,
		meta: access("estimates", "EDIT"),
	})
	async addLineItem(
		@Input() input: z.infer<typeof estimateAddLineItemInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.addLineItem(input, ctx.access);
	}

	@Mutation({
		input: estimateUpdateLineItemInput,
		meta: access("estimates", "EDIT"),
	})
	async updateLineItem(
		@Input() input: z.infer<typeof estimateUpdateLineItemInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.updateLineItem(input, ctx.access);
	}

	@Mutation({
		input: estimateLineItemIdInput,
		meta: access("estimates", "EDIT"),
	})
	async removeLineItem(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.estimates.removeLineItem(id, ctx.access);
	}

	@Mutation({
		input: estimateGenerateFromDrawingInput,
		meta: access("estimates", "EDIT"),
	})
	async generateFromDrawing(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof estimateGenerateFromDrawingInput>,
	) {
		return this.estimates.generateFromDrawing(input, ctx.access);
	}

	@Mutation({ input: estimateIdInput, meta: access("estimates", "EDIT") })
	async resyncFromDrawing(
		@Input("id") id: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.estimates.resyncFromDrawing(id, ctx.access);
	}

	@Mutation({
		input: estimateAssignContactInput,
		meta: access("estimates", "EDIT"),
	})
	async assignContact(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof estimateAssignContactInput>,
	) {
		return this.estimates.assignContact(input, ctx.access);
	}

	@Query({ input: estimateIdInput, meta: access("estimates", "VIEW") })
	async document(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.estimates.document(id, ctx.access);
	}

	@Mutation({ input: estimateSendInput, meta: access("estimates", "EDIT") })
	async send(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof estimateSendInput>,
	) {
		return this.estimates.send(input, ctx.user.name, ctx.access);
	}

	@Query({ meta: access("estimates", "VIEW") })
	async mailerConfigured() {
		return this.estimates.mailerConfigured();
	}
}
