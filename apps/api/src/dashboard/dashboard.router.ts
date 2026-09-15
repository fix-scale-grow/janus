import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	dashboardPipelineBoardInput,
	dashboardSummaryInput,
} from "./dashboard.contracts";
import { DashboardService } from "./dashboard.service";

@Router({ alias: "dashboard" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class DashboardRouter {
	constructor(
		@Inject(DashboardService) private readonly dashboard: DashboardService,
	) {}

	@Query({ input: dashboardSummaryInput, meta: anyMember() })
	async summary(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dashboardSummaryInput>,
	) {
		return this.dashboard.summary(ctx.user.id, input, ctx.access);
	}

	@Query({ input: dashboardSummaryInput, meta: anyMember() })
	async pipelineStages(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dashboardSummaryInput>,
	) {
		return this.dashboard.pipelineStages(ctx.user.id, input, ctx.access);
	}

	@Query({ input: dashboardPipelineBoardInput, meta: anyMember() })
	async pipelineBoard(
		@Input() input: z.infer<typeof dashboardPipelineBoardInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.dashboard.pipelineBoard(input, ctx.access);
	}
}
