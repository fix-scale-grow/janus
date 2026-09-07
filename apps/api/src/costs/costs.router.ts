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
	costCreateInput,
	costIdInput,
	costListInput,
	costUpdateInput,
	profitForDealInput,
} from "./costs.contracts";
import { CostsService } from "./costs.service";

@Router({ alias: "costs" })
@UseMiddlewares(AuthMiddleware)
export class CostsRouter {
	constructor(@Inject(CostsService) private readonly costs: CostsService) {}

	@Query({ input: costListInput })
	async list(@Input() input: z.infer<typeof costListInput>) {
		return this.costs.list(input);
	}

	@Mutation({ input: costCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof costCreateInput>,
	) {
		return this.costs.create(input, ctx.user.id);
	}

	@Mutation({ input: costUpdateInput })
	async update(@Input() input: z.infer<typeof costUpdateInput>) {
		return this.costs.update(input);
	}

	@Mutation({ input: costIdInput })
	async remove(@Input("id") id: string) {
		return this.costs.remove(id);
	}

	@Query({ input: profitForDealInput })
	async profitForDeal(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof profitForDealInput>,
	) {
		return this.costs.profitForDeal(ctx.user.id, input.dealId);
	}
}
