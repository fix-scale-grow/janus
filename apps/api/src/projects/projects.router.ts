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
	projectCreateInput,
	projectIdInput,
	projectListInput,
	projectUpdateInput,
	taskCreateInput,
	taskMoveInput,
	taskUpdateInput,
} from "./projects.contracts";
import { ProjectsService } from "./projects.service";

@Router({ alias: "projects" })
@UseMiddlewares(AuthMiddleware)
export class ProjectsRouter {
	constructor(
		@Inject(ProjectsService) private readonly projects: ProjectsService,
	) {}

	@Query({ input: projectListInput })
	async list(@Input() input: z.infer<typeof projectListInput>) {
		return this.projects.list(input);
	}

	@Query({ input: projectIdInput })
	async byId(@Input("id") id: string) {
		return this.projects.byId(id);
	}

	@Mutation({ input: projectCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof projectCreateInput>,
	) {
		return this.projects.create(input, ctx.user.id);
	}

	@Mutation({ input: projectUpdateInput })
	async update(@Input() input: z.infer<typeof projectUpdateInput>) {
		return this.projects.update(input);
	}

	@Mutation({ input: projectIdInput })
	async remove(@Input("id") id: string) {
		return this.projects.remove(id);
	}

	@Mutation({ input: taskCreateInput })
	async taskCreate(@Input() input: z.infer<typeof taskCreateInput>) {
		return this.projects.taskCreate(input);
	}

	@Mutation({ input: taskUpdateInput })
	async taskUpdate(@Input() input: z.infer<typeof taskUpdateInput>) {
		return this.projects.taskUpdate(input);
	}

	@Mutation({ input: taskMoveInput })
	async taskMove(@Input() input: z.infer<typeof taskMoveInput>) {
		return this.projects.taskMove(input);
	}

	@Mutation({ input: projectIdInput })
	async taskRemove(@Input("id") id: string) {
		return this.projects.taskRemove(id);
	}
}
