import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	permissionGrantInput,
	type PermissionGrantInput,
} from "./permissions.contracts";
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
		@Input() input: PermissionGrantInput,
	) {
		return this.permissions.grant(ctx.user.id, input);
	}

	@Mutation({ input: permissionGrantInput })
	async revoke(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: PermissionGrantInput,
	) {
		return this.permissions.revoke(ctx.user.id, input);
	}
}
