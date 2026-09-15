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
	invoiceAddLineItemInput,
	invoiceCreateFromEstimateInput,
	invoiceCreateInput,
	invoiceIdInput,
	invoiceLineItemIdInput,
	invoiceListInput,
	invoiceSendInput,
	invoiceSetStatusInput,
	invoiceUpdateInput,
	invoiceUpdateLineItemInput,
} from "./invoices.contracts";
import { InvoicesService } from "./invoices.service";

@Router({ alias: "invoices" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class InvoicesRouter {
	constructor(
		@Inject(InvoicesService) private readonly invoices: InvoicesService,
	) {}

	@Query({ input: invoiceListInput, meta: access("invoices", "VIEW") })
	async list(
		@Input() input: z.infer<typeof invoiceListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.invoices.list(input, ctx.access);
	}

	@Query({ input: invoiceIdInput, meta: access("invoices", "VIEW") })
	async byId(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.invoices.byId(id, ctx.access);
	}

	@Mutation({ input: invoiceCreateInput, meta: access("invoices", "EDIT") })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateInput>,
	) {
		return this.invoices.create(input, ctx.access);
	}

	@Mutation({
		input: invoiceCreateFromEstimateInput,
		meta: access("invoices", "EDIT"),
	})
	async createFromEstimate(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateFromEstimateInput>,
	) {
		return this.invoices.createFromEstimate(input, ctx.access);
	}

	@Mutation({ input: invoiceSetStatusInput, meta: access("invoices", "EDIT") })
	async setStatus(
		@Input() input: z.infer<typeof invoiceSetStatusInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.invoices.setStatus(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: invoiceIdInput, meta: access("invoices", "EDIT") })
	async markPaid(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.invoices.markPaid(id, ctx.user.id, ctx.access);
	}

	@Mutation({ input: invoiceUpdateInput, meta: access("invoices", "EDIT") })
	async update(
		@Input() input: z.infer<typeof invoiceUpdateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.invoices.update(input, ctx.access);
	}

	@Mutation({ input: invoiceIdInput, meta: access("invoices", "DELETE") })
	async delete(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.invoices.delete(id, ctx.access);
	}

	@Mutation({
		input: invoiceAddLineItemInput,
		meta: access("invoices", "EDIT"),
	})
	async addLineItem(
		@Input() input: z.infer<typeof invoiceAddLineItemInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.invoices.addLineItem(input, ctx.access);
	}

	@Mutation({
		input: invoiceUpdateLineItemInput,
		meta: access("invoices", "EDIT"),
	})
	async updateLineItem(
		@Input() input: z.infer<typeof invoiceUpdateLineItemInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.invoices.updateLineItem(input, ctx.access);
	}

	@Mutation({
		input: invoiceLineItemIdInput,
		meta: access("invoices", "DELETE"),
	})
	async removeLineItem(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.invoices.removeLineItem(id, ctx.access);
	}

	@Query({ input: invoiceIdInput, meta: access("invoices", "VIEW") })
	async document(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.invoices.document(id, ctx.access);
	}

	@Mutation({ input: invoiceSendInput, meta: access("invoices", "EDIT") })
	async send(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof invoiceSendInput>,
	) {
		return this.invoices.send(input, ctx.user.name, ctx.access);
	}
}
