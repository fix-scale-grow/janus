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
	costCreateInput,
	costIdInput,
	costListInput,
	costUpdateInput,
	profitForDealInput,
} from "./costs.contracts";
import { CostsService } from "./costs.service";

@Router({ alias: "costs" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class CostsRouter {
	constructor(@Inject(CostsService) private readonly costs: CostsService) {}

	@Query({ input: costListInput, meta: access("jobCosts", "VIEW") })
	async list(@Input() input: z.infer<typeof costListInput>) {
		return this.costs.list(input);
	}

	@Mutation({
		input: costCreateInput,
		meta: access("jobCosts", ["EDIT", "jobCosts.submit"], { field: true }),
	})
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof costCreateInput>,
	) {
		return this.costs.create(input, ctx.user.id);
	}

	@Mutation({ input: costUpdateInput, meta: access("jobCosts", "EDIT") })
	async update(@Input() input: z.infer<typeof costUpdateInput>) {
		return this.costs.update(input);
	}

	@Mutation({ input: costIdInput, meta: access("jobCosts", "DELETE") })
	async remove(@Input("id") id: string) {
		return this.costs.remove(id);
	}

	@Query({ input: profitForDealInput, meta: access("jobCosts", "VIEW") })
	async profitForDeal(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof profitForDealInput>,
	) {
		return this.costs.profitForDeal(ctx.user.id, input.dealId);
	}
}
