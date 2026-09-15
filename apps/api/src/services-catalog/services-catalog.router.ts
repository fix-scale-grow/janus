import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { access, anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	serviceCreateInput,
	serviceIdInput,
	serviceListInput,
	serviceUpdateInput,
} from "./services-catalog.contracts";
import { ServicesCatalogService } from "./services-catalog.service";

@Router({ alias: "services" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ServicesCatalogRouter {
	constructor(
		@Inject(ServicesCatalogService)
		private readonly services: ServicesCatalogService,
	) {}

	@Query({ input: serviceListInput, meta: anyMember() })
	async list(@Input() input: z.infer<typeof serviceListInput>) {
		return this.services.list(input);
	}

	@Query({ input: serviceIdInput, meta: anyMember() })
	async byId(@Input("id") id: string) {
		return this.services.byId(id);
	}

	@Mutation({ input: serviceCreateInput, meta: access("estimates", "EDIT") })
	async create(@Input() input: z.infer<typeof serviceCreateInput>) {
		return this.services.create(input);
	}

	@Mutation({ input: serviceUpdateInput, meta: access("estimates", "EDIT") })
	async update(@Input() input: z.infer<typeof serviceUpdateInput>) {
		return this.services.update(input);
	}

	@Mutation({ input: serviceIdInput, meta: access("estimates", "EDIT") })
	async delete(@Input("id") id: string) {
		return this.services.delete(id);
	}

	@Mutation({ meta: access("estimates", "EDIT") })
	async seedRoofing() {
		return this.services.seedRoofing();
	}
}
