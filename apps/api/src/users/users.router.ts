import { Inject } from "@nestjs/common";
import { Ctx, Query, Router, UseMiddlewares } from "nestjs-trpc";
import { anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import { AuthService } from "../auth/auth.service";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { UsersService } from "./users.service";

@Router({ alias: "users" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class UsersRouter {
	constructor(
		@Inject(UsersService) private readonly users: UsersService,
		@Inject(AuthService) private readonly auth: AuthService,
	) {}

	@Query({ meta: anyMember({ field: true }) })
	async me(@Ctx() ctx: AuthedTrpcContext) {
		return this.auth.getProfile(ctx.user.id);
	}

	@Query({ meta: anyMember({ field: true }) })
	async list() {
		return this.users.list();
	}
}
