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
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { permissionGrantInput } from "./permissions.contracts";
import { PermissionsService } from "./permissions.service";

@Router({ alias: "permissions" })
@UseMiddlewares(AuthMiddleware)
export class PermissionsRouter {
	constructor(
		@Inject(PermissionsService) private readonly permissions: PermissionsService,
	) {}

	@Query()
	async mine(@Ctx() ctx: AuthedTrpcContext) {
		return this.permissions.mine(ctx.user.id);
	}

	@Query()
	async listUsers(@Ctx() ctx: AuthedTrpcContext) {
		return this.permissions.listUsers(ctx.user.id);
	}

	@Mutation({ input: permissionGrantInput })
	async grant(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof permissionGrantInput>,
	) {
		return this.permissions.grant(ctx.user.id, input);
	}

	@Mutation({ input: permissionGrantInput })
	async revoke(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof permissionGrantInput>,
	) {
		return this.permissions.revoke(ctx.user.id, input);
	}
}
