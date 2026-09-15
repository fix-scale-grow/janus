import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { access } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { reportRangeInput } from "./reports.contracts";
import { ReportsService } from "./reports.service";

@Router({ alias: "reports" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ReportsRouter {
	constructor(
		@Inject(ReportsService) private readonly reports: ReportsService,
	) {}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async jobProfitability(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.jobProfitability(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async profitOverTime(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.profitOverTime(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async costBreakdown(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.costBreakdown(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async arAging(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.arAging(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async leaderboard(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.leaderboard(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async pipeline(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.pipeline(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async leadSources(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.leadSources(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async production(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.production(ctx.user.id, input);
	}

	@Query({ input: reportRangeInput, meta: access("reports", "VIEW") })
	async permits(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.permits(ctx.user.id, input);
	}
}
