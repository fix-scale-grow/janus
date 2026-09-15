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
	projectCalendarInput,
	projectCreateInput,
	projectIdInput,
	projectListInput,
	projectMoveScheduleInput,
	projectUpdateInput,
	taskCreateInput,
	taskMoveInput,
	taskUpdateInput,
} from "./projects.contracts";
import { ProjectsService } from "./projects.service";

@Router({ alias: "projects" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ProjectsRouter {
	constructor(
		@Inject(ProjectsService) private readonly projects: ProjectsService,
	) {}

	@Query({
		input: projectListInput,
		meta: access("projects", "VIEW", { field: true }),
	})
	async list(
		@Input() input: z.infer<typeof projectListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.projects.list(input, ctx.access);
	}

	@Query({ input: projectCalendarInput, meta: access("projects", "VIEW") })
	async calendarRange(
		@Input() input: z.infer<typeof projectCalendarInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.projects.calendarRange(input, ctx.access);
	}

	@Query({ meta: access("projects", "VIEW", { field: true }) })
	async upcomingTasks(@Ctx() ctx: AccessTrpcContext) {
		return this.projects.upcomingTasks(ctx.access);
	}

	@Query({
		input: projectIdInput,
		meta: access("projects", "VIEW", { field: true }),
	})
	async byId(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.projects.byId(id, ctx.access);
	}

	@Mutation({ input: projectCreateInput, meta: access("projects", "EDIT") })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof projectCreateInput>,
	) {
		return this.projects.create(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: projectUpdateInput, meta: access("projects", "EDIT") })
	async update(
		@Input() input: z.infer<typeof projectUpdateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.projects.update(input, ctx.user.id, ctx.access);
	}

	@Mutation({
		input: projectMoveScheduleInput,
		meta: access("projects", "EDIT"),
	})
	async moveSchedule(
		@Input() input: z.infer<typeof projectMoveScheduleInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.projects.moveSchedule(input, ctx.access);
	}

	@Mutation({ input: projectIdInput, meta: access("projects", "DELETE") })
	async remove(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.projects.remove(id, ctx.access);
	}

	@Mutation({ input: taskCreateInput, meta: access("projects", "EDIT") })
	async taskCreate(
		@Input() input: z.infer<typeof taskCreateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.projects.taskCreate(input, ctx.access);
	}

	@Mutation({
		input: taskUpdateInput,
		meta: access("projects", "EDIT", { field: true }),
	})
	async taskUpdate(
		@Input() input: z.infer<typeof taskUpdateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.projects.taskUpdate(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: taskMoveInput, meta: access("projects", "EDIT") })
	async taskMove(
		@Input() input: z.infer<typeof taskMoveInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.projects.taskMove(input, ctx.access);
	}

	@Mutation({ input: projectIdInput, meta: access("projects", "EDIT") })
	async taskRemove(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.projects.taskRemove(id, ctx.access);
	}
}
