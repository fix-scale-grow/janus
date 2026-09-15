import { Inject } from "@nestjs/common";
import { Ctx, Query, Router, UseMiddlewares } from "nestjs-trpc";
import { anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { PermissionsService } from "./permissions.service";

@Router({ alias: "permissions" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class PermissionsRouter {
	constructor(
		@Inject(PermissionsService)
		private readonly permissions: PermissionsService,
	) {}

	@Query({ meta: anyMember({ field: true }) })
	async mine(@Ctx() ctx: AccessTrpcContext) {
		return this.permissions.mine(ctx.access);
	}
}
