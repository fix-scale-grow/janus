import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import { adminOnly, anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	type PermissionGrantInput,
	permissionGrantInput,
} from "./permissions.contracts";
import { PermissionsService } from "./permissions.service";

@Router({ alias: "permissions" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class PermissionsRouter {
	constructor(
		@Inject(PermissionsService)
		private readonly permissions: PermissionsService,
	) {}

	@Query({ meta: anyMember({ field: true }) })
	async mine(@Ctx() ctx: AuthedTrpcContext) {
		return this.permissions.mine(ctx.user.id);
	}

	@Query({ meta: adminOnly() })
	async listUsers(@Ctx() ctx: AuthedTrpcContext) {
		return this.permissions.listUsers(ctx.user.id);
	}

	@Mutation({ input: permissionGrantInput, meta: adminOnly() })
	async grant(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: PermissionGrantInput,
	) {
		return this.permissions.grant(ctx.user.id, input);
	}

	@Mutation({ input: permissionGrantInput, meta: adminOnly() })
	async revoke(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: PermissionGrantInput,
	) {
		return this.permissions.revoke(ctx.user.id, input);
	}
}
