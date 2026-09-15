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
	async list(@Input() input: z.infer<typeof contractListInput>) {
		return this.contracts.list(input);
	}

	@Query({ input: contractIdInput, meta: access("contracts", "VIEW") })
	async byId(@Input("id") id: string) {
		return this.contracts.byId(id);
	}

	@Mutation({
		input: contractCreateFromEstimateInput,
		meta: access("contracts", "EDIT"),
	})
	async createFromEstimate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contractCreateFromEstimateInput>,
	) {
		return this.contracts.createFromEstimate(input, ctx.user.id);
	}

	@Mutation({ input: contractCreateInput, meta: access("contracts", "EDIT") })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contractCreateInput>,
	) {
		return this.contracts.create(input, ctx.user.id);
	}

	@Mutation({ input: contractUpdateInput, meta: access("contracts", "EDIT") })
	async update(@Input() input: z.infer<typeof contractUpdateInput>) {
		return this.contracts.update(input);
	}

	@Mutation({ input: contractSendInput, meta: access("contracts", "EDIT") })
	async send(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contractSendInput>,
	) {
		return this.contracts.send(input, ctx.user.name);
	}

	@Mutation({ input: contractIdInput, meta: access("contracts", "EDIT") })
	async void(@Input("id") id: string) {
		return this.contracts.void(id);
	}

	@Mutation({ input: contractIdInput, meta: access("contracts", "DELETE") })
	async delete(@Input("id") id: string) {
		return this.contracts.delete(id);
	}

	@Query({ input: contractIdInput, meta: access("contracts", "VIEW") })
	async document(@Input("id") id: string) {
		return this.contracts.document(id);
	}

	@Query({ meta: access("contracts", "VIEW") })
	async mailerConfigured() {
		return this.contracts.mailerConfigured();
	}
}
