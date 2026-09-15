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
import { anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { setOutlookAutoCreateInput } from "./microsoft.contracts";
import { MicrosoftConnectionService } from "./microsoft-connection.service";
import { MicrosoftSyncService } from "./microsoft-sync.service";

@Router({ alias: "microsoft" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class MicrosoftRouter {
	constructor(
		@Inject(MicrosoftConnectionService)
		private readonly connection: MicrosoftConnectionService,
		@Inject(MicrosoftSyncService)
		private readonly sync: MicrosoftSyncService,
	) {}

	@Query({ meta: anyMember() })
	async status(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.status(ctx.user.id);
	}

	@Mutation({ meta: anyMember() })
	async purgeSyncedData(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.purgeSyncedData(ctx.user.id);
	}

	@Mutation({ meta: anyMember() })
	async revokeAccess(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.revoke(ctx.user.id);
	}

	@Mutation({ meta: anyMember() })
	async syncNow(@Ctx() ctx: AuthedTrpcContext) {
		await this.sync.runForUser(ctx.user.id);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({ input: setOutlookAutoCreateInput, meta: anyMember() })
	async setAutoCreate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setOutlookAutoCreateInput>,
	) {
		await this.connection.setAutoCreate(
			ctx.user.id,
			input.source,
			input.enabled,
		);
		return this.connection.status(ctx.user.id);
	}
}
