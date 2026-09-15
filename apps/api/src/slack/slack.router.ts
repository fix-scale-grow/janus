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
import { adminOnly } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	slackChannelsInput,
	slackCreateChannelInput,
	slackJoinChannelInput,
} from "./slack.contracts";
import { SlackConnectionService } from "./slack-connection.service";

@Router({ alias: "slack" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class SlackRouter {
	constructor(
		@Inject(SlackConnectionService)
		private readonly connection: SlackConnectionService,
	) {}

	@Query({ meta: adminOnly() })
	status(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.status(ctx.user.id);
	}

	@Query({ meta: adminOnly() })
	matches(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.matches(ctx.user.id);
	}

	@Query({ input: slackChannelsInput, meta: adminOnly() })
	channels(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof slackChannelsInput>,
	) {
		return this.connection.channels(input, ctx.user.id);
	}

	@Mutation({ input: slackJoinChannelInput, meta: adminOnly() })
	joinChannel(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof slackJoinChannelInput>,
	) {
		return this.connection.joinChannel(input, ctx.user.id);
	}

	@Mutation({ meta: adminOnly() })
	refreshPeople(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.refreshPeople(ctx.user.id);
	}

	@Mutation({ input: slackCreateChannelInput, meta: adminOnly() })
	createChannel(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof slackCreateChannelInput>,
	) {
		return this.connection.createChannel(input, ctx.user.id);
	}

	@Mutation({ meta: adminOnly() })
	disconnect(@Ctx() ctx: AuthedTrpcContext) {
		return this.connection.disconnect(ctx.user.id);
	}
}
