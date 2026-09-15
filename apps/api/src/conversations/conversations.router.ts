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
import { ConversationSharingService } from "./conversation-sharing.service";
import {
	builderConversationCreateInput,
	builderConversationSubmitInput,
	builderQuestionResponseInput,
	builderResourceSearchInput,
	builderResponseRatingInput,
	conversationEventsInput,
	conversationIdInput,
	conversationListInput,
	conversationSaveInput,
	sharedConversationInput,
} from "./conversations.contracts";
import { ConversationsService } from "./conversations.service";

@Router({ alias: "conversations" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ConversationsRouter {
	constructor(
		@Inject(ConversationsService)
		private readonly conversations: ConversationsService,
		@Inject(ConversationSharingService)
		private readonly sharing: ConversationSharingService,
	) {}

	@Query({ input: conversationListInput, meta: anyMember() })
	async list(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof conversationListInput>,
	) {
		return this.conversations.list(input, ctx.user.id, ctx.access);
	}

	@Query({ meta: anyMember() })
	async builderList(@Ctx() ctx: AuthedTrpcContext) {
		return this.conversations.listBuilder(ctx.user.id);
	}

	@Query({ input: builderResourceSearchInput, meta: anyMember() })
	async builderResources(@Ctx() ctx: AuthedTrpcContext, @Input("q") q: string) {
		return this.conversations.builderResources(q, ctx.user.id);
	}

	@Query({ input: conversationIdInput, meta: anyMember() })
	async builderById(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.conversations.builderById(id, ctx.user.id);
	}

	@Query({ input: conversationEventsInput, meta: anyMember() })
	async events(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof conversationEventsInput>,
	) {
		return this.conversations.events(input, ctx.user.id);
	}

	@Mutation({ input: conversationSaveInput, meta: anyMember() })
	async save(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof conversationSaveInput>,
	) {
		return this.conversations.save(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: builderConversationCreateInput, meta: anyMember() })
	async createBuilder(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof builderConversationCreateInput>,
	) {
		return this.conversations.createBuilder(input, ctx.user.id);
	}

	@Mutation({ input: builderConversationSubmitInput, meta: anyMember() })
	async submitBuilder(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof builderConversationSubmitInput>,
	) {
		return this.conversations.submitBuilder(input, ctx.user.id);
	}

	@Mutation({ input: builderQuestionResponseInput, meta: anyMember() })
	async answerBuilderQuestion(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof builderQuestionResponseInput>,
	) {
		return this.conversations.answerBuilderQuestion(input, ctx.user.id);
	}

	@Mutation({ input: builderResponseRatingInput, meta: anyMember() })
	async rateBuilderResponse(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof builderResponseRatingInput>,
	) {
		return this.conversations.rateBuilderResponse(input, ctx.user.id);
	}

	@Mutation({ input: conversationIdInput, meta: anyMember() })
	async markRead(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.conversations.markRead(id, ctx.user.id);
	}

	@Query({ input: conversationIdInput, meta: anyMember() })
	async shareStatus(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.sharing.status(id, ctx.user.id);
	}

	@Mutation({ input: conversationIdInput, meta: anyMember() })
	async createShare(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.sharing.create(id, ctx.user.id);
	}

	@Mutation({ input: conversationIdInput, meta: anyMember() })
	async revokeShare(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.sharing.revoke(id, ctx.user.id);
	}

	@Query({ input: sharedConversationInput, meta: anyMember() })
	async shared(@Ctx() ctx: AuthedTrpcContext, @Input("token") token: string) {
		return this.sharing.resolve(token, ctx.user.id);
	}

	@Mutation({ input: conversationIdInput, meta: anyMember() })
	async remove(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.conversations.remove(id, ctx.user.id);
	}
}
