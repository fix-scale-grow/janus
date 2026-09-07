import { Inject } from "@nestjs/common";
import {
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	crewCreateInput,
	crewIdInput,
	crewUpdateInput,
} from "./crews.contracts";
import { CrewsService } from "./crews.service";

@Router({ alias: "crews" })
@UseMiddlewares(AuthMiddleware)
export class CrewsRouter {
	constructor(@Inject(CrewsService) private readonly crews: CrewsService) {}

	@Query()
	async list() {
		return this.crews.list();
	}

	@Mutation({ input: crewCreateInput })
	async create(@Input() input: z.infer<typeof crewCreateInput>) {
		return this.crews.create(input);
	}

	@Mutation({ input: crewUpdateInput })
	async update(@Input() input: z.infer<typeof crewUpdateInput>) {
		return this.crews.update(input);
	}

	@Mutation({ input: crewIdInput })
	async remove(@Input("id") id: string) {
		return this.crews.remove(id);
	}
}
