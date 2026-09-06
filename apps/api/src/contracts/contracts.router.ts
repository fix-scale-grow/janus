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
	contractCreateFromEstimateInput,
	contractCreateInput,
	contractIdInput,
	contractListInput,
	contractSendInput,
	contractUpdateInput,
} from "./contracts.contracts";
import { ContractsService } from "./contracts.service";

@Router({ alias: "contracts" })
@UseMiddlewares(AuthMiddleware)
export class ContractsRouter {
	constructor(
		@Inject(ContractsService) private readonly contracts: ContractsService,
	) {}

	@Query({ input: contractListInput })
	async list(@Input() input: z.infer<typeof contractListInput>) {
		return this.contracts.list(input);
	}

	@Query({ input: contractIdInput })
	async byId(@Input("id") id: string) {
		return this.contracts.byId(id);
	}

	@Mutation({ input: contractCreateFromEstimateInput })
	async createFromEstimate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contractCreateFromEstimateInput>,
	) {
		return this.contracts.createFromEstimate(input, ctx.user.id);
	}

	@Mutation({ input: contractCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contractCreateInput>,
	) {
		return this.contracts.create(input, ctx.user.id);
	}

	@Mutation({ input: contractUpdateInput })
	async update(@Input() input: z.infer<typeof contractUpdateInput>) {
		return this.contracts.update(input);
	}

	@Mutation({ input: contractSendInput })
	async send(@Input() input: z.infer<typeof contractSendInput>) {
		return this.contracts.send(input);
	}

	@Mutation({ input: contractIdInput })
	async void(@Input("id") id: string) {
		return this.contracts.void(id);
	}

	@Mutation({ input: contractIdInput })
	async delete(@Input("id") id: string) {
		return this.contracts.delete(id);
	}

	@Query({ input: contractIdInput })
	async document(@Input("id") id: string) {
		return this.contracts.document(id);
	}

	@Query()
	async mailerConfigured() {
		return this.contracts.mailerConfigured();
	}
}
