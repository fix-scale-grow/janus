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
	async list(@Input() input: z.infer<typeof invoiceListInput>) {
		return this.invoices.list(input);
	}

	@Query({ input: invoiceIdInput, meta: access("invoices", "VIEW") })
	async byId(@Input("id") id: string) {
		return this.invoices.byId(id);
	}

	@Mutation({ input: invoiceCreateInput, meta: access("invoices", "EDIT") })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateInput>,
	) {
		return this.invoices.create(input, ctx.user.id);
	}

	@Mutation({
		input: invoiceCreateFromEstimateInput,
		meta: access("invoices", "EDIT"),
	})
	async createFromEstimate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateFromEstimateInput>,
	) {
		return this.invoices.createFromEstimate(input, ctx.user.id);
	}

	@Mutation({ input: invoiceSetStatusInput, meta: access("invoices", "EDIT") })
	async setStatus(
		@Input() input: z.infer<typeof invoiceSetStatusInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.invoices.setStatus(input, ctx.user.id);
	}

	@Mutation({ input: invoiceIdInput, meta: access("invoices", "EDIT") })
	async markPaid(@Input("id") id: string, @Ctx() ctx: AuthedTrpcContext) {
		return this.invoices.markPaid(id, ctx.user.id);
	}

	@Mutation({ input: invoiceUpdateInput, meta: access("invoices", "EDIT") })
	async update(@Input() input: z.infer<typeof invoiceUpdateInput>) {
		return this.invoices.update(input);
	}

	@Mutation({ input: invoiceIdInput, meta: access("invoices", "DELETE") })
	async delete(@Input("id") id: string) {
		return this.invoices.delete(id);
	}

	@Mutation({
		input: invoiceAddLineItemInput,
		meta: access("invoices", "EDIT"),
	})
	async addLineItem(@Input() input: z.infer<typeof invoiceAddLineItemInput>) {
		return this.invoices.addLineItem(input);
	}

	@Mutation({
		input: invoiceUpdateLineItemInput,
		meta: access("invoices", "EDIT"),
	})
	async updateLineItem(
		@Input() input: z.infer<typeof invoiceUpdateLineItemInput>,
	) {
		return this.invoices.updateLineItem(input);
	}

	@Mutation({
		input: invoiceLineItemIdInput,
		meta: access("invoices", "DELETE"),
	})
	async removeLineItem(@Input("id") id: string) {
		return this.invoices.removeLineItem(id);
	}

	@Query({ input: invoiceIdInput, meta: access("invoices", "VIEW") })
	async document(@Input("id") id: string) {
		return this.invoices.document(id);
	}

	@Mutation({ input: invoiceSendInput, meta: access("invoices", "EDIT") })
	async send(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceSendInput>,
	) {
		return this.invoices.send(input, ctx.user.name);
	}
}
