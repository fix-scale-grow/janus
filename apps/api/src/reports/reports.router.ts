import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { reportRangeInput } from "./reports.contracts";
import { ReportsService } from "./reports.service";

@Router({ alias: "reports" })
@UseMiddlewares(AuthMiddleware)
export class ReportsRouter {
	constructor(
		@Inject(ReportsService) private readonly reports: ReportsService,
	) {}

	@Query({ input: reportRangeInput })
	async jobProfitability(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.jobProfitability(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async profitOverTime(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.profitOverTime(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async costBreakdown(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.costBreakdown(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async arAging(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.arAging(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async leaderboard(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.leaderboard(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async pipeline(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.pipeline(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async leadSources(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.leadSources(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async production(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.production(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput })
	async permits(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.permits(ctx.user.id, input);
	}
}
