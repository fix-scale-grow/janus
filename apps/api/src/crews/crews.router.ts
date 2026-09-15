import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { access, anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	crewCreateInput,
	crewIdInput,
	crewUpdateInput,
} from "./crews.contracts";
import { CrewsService } from "./crews.service";

@Router({ alias: "crews" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class CrewsRouter {
	constructor(@Inject(CrewsService) private readonly crews: CrewsService) {}

	@Query({ meta: anyMember({ field: true }) })
	async list() {
		return this.crews.list();
	}

	@Mutation({ input: crewCreateInput, meta: access("projects", "EDIT") })
	async create(@Input() input: z.infer<typeof crewCreateInput>) {
		return this.crews.create(input);
	}

	@Mutation({ input: crewUpdateInput, meta: access("projects", "EDIT") })
	async update(@Input() input: z.infer<typeof crewUpdateInput>) {
		return this.crews.update(input);
	}

	@Mutation({ input: crewIdInput, meta: access("projects", "EDIT") })
	async remove(@Input("id") id: string) {
		return this.crews.remove(id);
	}
}
