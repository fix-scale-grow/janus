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
	contractCreateFromEstimateInput,
	contractCreateInput,
	contractIdInput,
	contractListInput,
	contractSendInput,
	contractUpdateInput,
} from "./contracts.contracts";
import { ContractsService } from "./contracts.service";

@Router({ alias: "contracts" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ContractsRouter {
	constructor(
		@Inject(ContractsService) private readonly contracts: ContractsService,
	) {}

	@Query({ input: contractListInput, meta: access("contracts", "VIEW") })
	async list(
		@Input() input: z.infer<typeof contractListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.contracts.list(input, ctx.access);
	}

	@Query({ input: contractIdInput, meta: access("contracts", "VIEW") })
	async byId(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.contracts.byId(id, ctx.access);
	}

	@Mutation({
		input: contractCreateFromEstimateInput,
		meta: access("contracts", "EDIT"),
	})
	async createFromEstimate(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof contractCreateFromEstimateInput>,
	) {
		return this.contracts.createFromEstimate(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: contractCreateInput, meta: access("contracts", "EDIT") })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof contractCreateInput>,
	) {
		return this.contracts.create(input, ctx.access);
	}

	@Mutation({ input: contractUpdateInput, meta: access("contracts", "EDIT") })
	async update(
		@Input() input: z.infer<typeof contractUpdateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.contracts.update(input, ctx.access);
	}

	@Mutation({ input: contractSendInput, meta: access("contracts", "EDIT") })
	async send(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof contractSendInput>,
	) {
		return this.contracts.send(input, ctx.user.name, ctx.access);
	}

	@Mutation({ input: contractIdInput, meta: access("contracts", "EDIT") })
	async void(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.contracts.void(id, ctx.access);
	}

	@Mutation({ input: contractIdInput, meta: access("contracts", "DELETE") })
	async delete(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.contracts.delete(id, ctx.access);
	}

	@Query({ input: contractIdInput, meta: access("contracts", "VIEW") })
	async document(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.contracts.document(id, ctx.access);
	}

	@Query({ meta: access("contracts", "VIEW") })
	async mailerConfigured() {
		return this.contracts.mailerConfigured();
	}
}
