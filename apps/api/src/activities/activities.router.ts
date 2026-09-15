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
import { anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	activityCreateInput,
	completeInput,
	myTasksInput,
	timelineCountsInput,
	timelineInput,
} from "./activities.contracts";
import { ActivitiesService } from "./activities.service";

@Router({ alias: "activities" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ActivitiesRouter {
	constructor(
		@Inject(ActivitiesService) private readonly activities: ActivitiesService,
	) {}

	@Query({ input: timelineInput, meta: anyMember() })
	async timeline(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof timelineInput>,
	) {
		return this.activities.timeline(input, ctx.access);
	}

	@Query({ input: timelineCountsInput, meta: anyMember() })
	async timelineCounts(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof timelineCountsInput>,
	) {
		return this.activities.timelineCounts(input, ctx.access);
	}

	@Query({ input: myTasksInput, meta: anyMember() })
	async myTasks(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof myTasksInput>,
	) {
		return this.activities.myTasks(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: activityCreateInput, meta: anyMember() })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof activityCreateInput>,
	) {
		return this.activities.create(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: completeInput, meta: anyMember() })
	async complete(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof completeInput>,
	) {
		return this.activities.complete(input.id, input.completed, ctx.access);
	}
}
