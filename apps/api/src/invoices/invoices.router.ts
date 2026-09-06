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
@UseMiddlewares(AuthMiddleware)
export class InvoicesRouter {
	constructor(
		@Inject(InvoicesService) private readonly invoices: InvoicesService,
	) {}

	@Query({ input: invoiceListInput })
	async list(@Input() input: z.infer<typeof invoiceListInput>) {
		return this.invoices.list(input);
	}

	@Query({ input: invoiceIdInput })
	async byId(@Input("id") id: string) {
		return this.invoices.byId(id);
	}

	@Mutation({ input: invoiceCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateInput>,
	) {
		return this.invoices.create(input, ctx.user.id);
	}

	@Mutation({ input: invoiceCreateFromEstimateInput })
	async createFromEstimate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceCreateFromEstimateInput>,
	) {
		return this.invoices.createFromEstimate(input, ctx.user.id);
	}

	@Mutation({ input: invoiceSetStatusInput })
	async setStatus(@Input() input: z.infer<typeof invoiceSetStatusInput>) {
		return this.invoices.setStatus(input);
	}

	@Mutation({ input: invoiceIdInput })
	async markPaid(@Input("id") id: string) {
		return this.invoices.markPaid(id);
	}

	@Mutation({ input: invoiceUpdateInput })
	async update(@Input() input: z.infer<typeof invoiceUpdateInput>) {
		return this.invoices.update(input);
	}

	@Mutation({ input: invoiceIdInput })
	async delete(@Input("id") id: string) {
		return this.invoices.delete(id);
	}

	@Mutation({ input: invoiceAddLineItemInput })
	async addLineItem(@Input() input: z.infer<typeof invoiceAddLineItemInput>) {
		return this.invoices.addLineItem(input);
	}

	@Mutation({ input: invoiceUpdateLineItemInput })
	async updateLineItem(
		@Input() input: z.infer<typeof invoiceUpdateLineItemInput>,
	) {
		return this.invoices.updateLineItem(input);
	}

	@Mutation({ input: invoiceLineItemIdInput })
	async removeLineItem(@Input("id") id: string) {
		return this.invoices.removeLineItem(id);
	}

	@Query({ input: invoiceIdInput })
	async document(@Input("id") id: string) {
		return this.invoices.document(id);
	}

	@Mutation({ input: invoiceSendInput })
	async send(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof invoiceSendInput>,
	) {
		return this.invoices.send(input, ctx.user.name);
	}
}
