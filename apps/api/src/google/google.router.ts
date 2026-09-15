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
import type {
	AccessTrpcContext,
	AuthedTrpcContext,
} from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { ConversationService } from "./conversation.service";
import {
	calendarEventInput,
	setAutoCreateInput,
	suppressDomainInput,
	threadInput,
} from "./google.contracts";
import { GoogleConnectionService } from "./google-connection.service";
import { GoogleSyncService } from "./google-sync.service";

@Router({ alias: "google" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class GoogleRouter {
	constructor(
		@Inject(GoogleConnectionService)
		private readonly connection: GoogleConnectionService,
		@Inject(GoogleSyncService) private readonly sync: GoogleSyncService,
		@Inject(ConversationService)
		private readonly conversations: ConversationService,
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

	@Mutation({ input: setAutoCreateInput, meta: anyMember() })
	async setAutoCreate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setAutoCreateInput>,
	) {
		await this.connection.setAutoCreate(
			ctx.user.id,
			input.source,
			input.enabled,
		);
		return this.connection.status(ctx.user.id);
	}

	@Mutation({ input: suppressDomainInput, meta: anyMember() })
	async suppressDomain(@Input() input: z.infer<typeof suppressDomainInput>) {
		return this.connection.suppressDomain(input.domain, {
			reason: input.reason,
			purge: input.purge,
		});
	}

	@Query({ input: threadInput, meta: anyMember() })
	async thread(
		@Ctx() ctx: AccessTrpcContext,
		@Input("threadId") threadId: string,
	) {
		return this.conversations.thread(threadId, ctx.access);
	}

	@Query({ input: calendarEventInput, meta: anyMember() })
	async event(
		@Ctx() ctx: AccessTrpcContext,
		@Input("eventId") eventId: string,
	) {
		return this.conversations.event(eventId, ctx.access);
	}
}
