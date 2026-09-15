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
import { access, anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
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
	async list(
		@Input() input: z.infer<typeof serviceListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.services.list(input, ctx.access);
	}

	@Query({ input: serviceIdInput, meta: anyMember() })
	async byId(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.services.byId(id, ctx.access);
	}

	@Mutation({ input: serviceCreateInput, meta: access("estimates", "EDIT") })
	async create(
		@Input() input: z.infer<typeof serviceCreateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.services.create(input, ctx.access);
	}

	@Mutation({ input: serviceUpdateInput, meta: access("estimates", "EDIT") })
	async update(
		@Input() input: z.infer<typeof serviceUpdateInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.services.update(input, ctx.access);
	}

	@Mutation({ input: serviceIdInput, meta: access("estimates", "EDIT") })
	async delete(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.services.delete(id, ctx.access);
	}

	@Mutation({ meta: access("estimates", "EDIT") })
	async seedRoofing(@Ctx() ctx: AccessTrpcContext) {
		return this.services.seedRoofing(ctx.access);
	}
}
