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
import { adminOnly, anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import { SettingsService } from "../settings/settings.service";
import type {
	AccessTrpcContext,
	AuthedTrpcContext,
} from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	memberListInput,
	setMemberRoleInput,
	updateWorkspaceInput,
} from "./workspace.contracts";
import { WorkspaceService } from "./workspace.service";

@Router({ alias: "workspace" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class WorkspaceRouter {
	constructor(
		@Inject(WorkspaceService) private readonly workspace: WorkspaceService,
		@Inject(SettingsService) private readonly settings: SettingsService,
	) {}

	@Query({ meta: anyMember({ field: true }) })
	async get(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.get(ctx.user.id);
	}

	@Query({ meta: anyMember({ field: true }) })
	async gate(@Ctx() ctx: AccessTrpcContext) {
		const [workspace, research] = await Promise.all([
			this.workspace.get(ctx.user.id),
			this.settings.researchKey(),
		]);
		return {
			onboarded: workspace.onboarded,
			canRename: workspace.canRename,
			slug: workspace.slug,
			researchConfigured: research.configured,
			surface: ctx.access.surface,
			isAdmin: ctx.access.isAdmin,
		};
	}

	@Query({ input: memberListInput, meta: anyMember({ field: true }) })
	async members(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof memberListInput>,
	) {
		return this.workspace.members(ctx.user.id, input);
	}

	@Mutation({ input: updateWorkspaceInput, meta: adminOnly() })
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateWorkspaceInput>,
	) {
		return this.workspace.update(ctx.user.id, input);
	}

	@Mutation({ input: setMemberRoleInput, meta: adminOnly() })
	async setMemberRole(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setMemberRoleInput>,
	) {
		return this.workspace.setMemberRole(ctx.user.id, input);
	}
}
