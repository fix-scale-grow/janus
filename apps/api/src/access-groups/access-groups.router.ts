import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import { adminOnly } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	type AccessGroupIdInput,
	type AccessGroupInput,
	type AccessGroupUpdateInput,
	accessGroupIdInput,
	accessGroupInput,
	accessGroupUpdateInput,
	type SetMemberAccessInput,
	setMemberAccessInput,
} from "./access-groups.contracts";
import { AccessGroupsService } from "./access-groups.service";

@Router({ alias: "accessGroups" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class AccessGroupsRouter {
	constructor(
		@Inject(AccessGroupsService)
		private readonly groups: AccessGroupsService,
	) {}

	@Query({ meta: adminOnly() })
	async list(@Ctx() ctx: AccessTrpcContext) {
		return this.groups.list(ctx.access);
	}

	@Mutation({ input: accessGroupInput, meta: adminOnly() })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: AccessGroupInput,
	) {
		return this.groups.create(input, ctx.access);
	}

	@Mutation({ input: accessGroupUpdateInput, meta: adminOnly() })
	async update(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: AccessGroupUpdateInput,
	) {
		return this.groups.update(input, ctx.access);
	}

	@Mutation({ input: accessGroupIdInput, meta: adminOnly() })
	async delete(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: AccessGroupIdInput,
	) {
		return this.groups.delete(input, ctx.access);
	}

	@Mutation({ input: setMemberAccessInput, meta: adminOnly() })
	async setMemberAccess(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: SetMemberAccessInput,
	) {
		return this.groups.setMemberAccess(input, ctx.access);
	}
}
