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

	@Query()
	async byClient(@Ctx() ctx: AuthedTrpcContext) {
		return this.reports.byClient(ctx.user.id);
	}

	@Query()
	async byMonth(@Ctx() ctx: AuthedTrpcContext) {
		return this.reports.byMonth(ctx.user.id);
	}

	@Query({ input: reportRangeInput })
	async byCategory(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof reportRangeInput>,
	) {
		return this.reports.byCategory(ctx.user.id, input);
	}
}
