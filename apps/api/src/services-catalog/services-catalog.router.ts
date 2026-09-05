import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	serviceCreateInput,
	serviceIdInput,
	serviceListInput,
	serviceUpdateInput,
} from "./services-catalog.contracts";
import { ServicesCatalogService } from "./services-catalog.service";

@Router({ alias: "services" })
@UseMiddlewares(AuthMiddleware)
export class ServicesCatalogRouter {
	constructor(
		@Inject(ServicesCatalogService)
		private readonly services: ServicesCatalogService,
	) {}

	@Query({ input: serviceListInput })
	async list(@Input() input: z.infer<typeof serviceListInput>) {
		return this.services.list(input);
	}

	@Query({ input: serviceIdInput })
	async byId(@Input("id") id: string) {
		return this.services.byId(id);
	}

	@Mutation({ input: serviceCreateInput })
	async create(@Input() input: z.infer<typeof serviceCreateInput>) {
		return this.services.create(input);
	}

	@Mutation({ input: serviceUpdateInput })
	async update(@Input() input: z.infer<typeof serviceUpdateInput>) {
		return this.services.update(input);
	}

	@Mutation({ input: serviceIdInput })
	async delete(@Input("id") id: string) {
		return this.services.delete(id);
	}

	@Mutation()
	async seedRoofing() {
		return this.services.seedRoofing();
	}
}
