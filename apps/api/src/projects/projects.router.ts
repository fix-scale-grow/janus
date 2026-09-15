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
	async list(@Input() input: z.infer<typeof projectListInput>) {
		return this.projects.list(input);
	}

	@Query({ input: projectCalendarInput, meta: access("projects", "VIEW") })
	async calendarRange(@Input() input: z.infer<typeof projectCalendarInput>) {
		return this.projects.calendarRange(input);
	}

	@Query({ meta: access("projects", "VIEW", { field: true }) })
	async upcomingTasks() {
		return this.projects.upcomingTasks();
	}

	@Query({
		input: projectIdInput,
		meta: access("projects", "VIEW", { field: true }),
	})
	async byId(@Input("id") id: string) {
		return this.projects.byId(id);
	}

	@Mutation({ input: projectCreateInput, meta: access("projects", "EDIT") })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof projectCreateInput>,
	) {
		return this.projects.create(input, ctx.user.id);
	}

	@Mutation({ input: projectUpdateInput, meta: access("projects", "EDIT") })
	async update(
		@Input() input: z.infer<typeof projectUpdateInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.projects.update(input, ctx.user.id);
	}

	@Mutation({
		input: projectMoveScheduleInput,
		meta: access("projects", "EDIT"),
	})
	async moveSchedule(@Input() input: z.infer<typeof projectMoveScheduleInput>) {
		return this.projects.moveSchedule(input);
	}

	@Mutation({ input: projectIdInput, meta: access("projects", "DELETE") })
	async remove(@Input("id") id: string) {
		return this.projects.remove(id);
	}

	@Mutation({ input: taskCreateInput, meta: access("projects", "EDIT") })
	async taskCreate(@Input() input: z.infer<typeof taskCreateInput>) {
		return this.projects.taskCreate(input);
	}

	@Mutation({
		input: taskUpdateInput,
		meta: access("projects", "EDIT", { field: true }),
	})
	async taskUpdate(
		@Input() input: z.infer<typeof taskUpdateInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.projects.taskUpdate(input, ctx.user.id);
	}

	@Mutation({ input: taskMoveInput, meta: access("projects", "EDIT") })
	async taskMove(@Input() input: z.infer<typeof taskMoveInput>) {
		return this.projects.taskMove(input);
	}

	@Mutation({
		input: projectIdInput,
		meta: access("projects", "DELETE", { field: true }),
	})
	async taskRemove(@Input("id") id: string) {
		return this.projects.taskRemove(id);
	}
}
