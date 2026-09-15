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
import type {
	AccessTrpcContext,
	AuthedTrpcContext,
} from "../trpc/context.types";
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
	async list(@Input() input: z.infer<typeof estimateListInput>) {
		return this.estimates.list(input);
	}

	@Query({ input: estimateIdInput, meta: access("estimates", "VIEW") })
	async byId(@Input("id") id: string) {
		return this.estimates.byId(id);
	}

	@Mutation({ input: estimateCreateInput, meta: access("estimates", "EDIT") })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof estimateCreateInput>,
	) {
		return this.estimates.create(input, ctx.user.id);
	}

	@Mutation({ input: estimateRenameInput, meta: access("estimates", "EDIT") })
	async rename(@Input() input: z.infer<typeof estimateRenameInput>) {
		return this.estimates.rename(input);
	}

	@Mutation({
		input: estimateUpdateTextInput,
		meta: access("estimates", "EDIT"),
	})
	async updateText(@Input() input: z.infer<typeof estimateUpdateTextInput>) {
		return this.estimates.updateText(input);
	}

	@Mutation({
		input: estimateSetStatusInput,
		meta: access("estimates", "EDIT"),
	})
	async setStatus(@Input() input: z.infer<typeof estimateSetStatusInput>) {
		return this.estimates.setStatus(input);
	}

	@Mutation({ input: estimateSetTierInput, meta: access("estimates", "EDIT") })
	async setTier(@Input() input: z.infer<typeof estimateSetTierInput>) {
		return this.estimates.setTier(input);
	}

	@Mutation({ input: estimateIdInput, meta: access("estimates", "DELETE") })
	async delete(@Input("id") id: string) {
		return this.estimates.delete(id);
	}

	@Mutation({
		input: estimateAddLineItemInput,
		meta: access("estimates", "EDIT"),
	})
	async addLineItem(@Input() input: z.infer<typeof estimateAddLineItemInput>) {
		return this.estimates.addLineItem(input);
	}

	@Mutation({
		input: estimateUpdateLineItemInput,
		meta: access("estimates", "EDIT"),
	})
	async updateLineItem(
		@Input() input: z.infer<typeof estimateUpdateLineItemInput>,
	) {
		return this.estimates.updateLineItem(input);
	}

	@Mutation({
		input: estimateLineItemIdInput,
		meta: access("estimates", "DELETE"),
	})
	async removeLineItem(@Input("id") id: string) {
		return this.estimates.removeLineItem(id);
	}

	@Mutation({
		input: estimateGenerateFromDrawingInput,
		meta: access("estimates", "EDIT"),
	})
	async generateFromDrawing(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof estimateGenerateFromDrawingInput>,
	) {
		return this.estimates.generateFromDrawing(input, ctx.user.id);
	}

	@Mutation({ input: estimateIdInput, meta: access("estimates", "EDIT") })
	async resyncFromDrawing(@Input("id") id: string) {
		return this.estimates.resyncFromDrawing(id);
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
	async document(@Input("id") id: string) {
		return this.estimates.document(id);
	}

	@Mutation({ input: estimateSendInput, meta: access("estimates", "EDIT") })
	async send(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof estimateSendInput>,
	) {
		return this.estimates.send(input, ctx.user.name);
	}

	@Query({ meta: access("estimates", "VIEW") })
	async mailerConfigured() {
		return this.estimates.mailerConfigured();
	}
}
