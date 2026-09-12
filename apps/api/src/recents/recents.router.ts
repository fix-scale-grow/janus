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
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { recentTouchInput } from "./recents.contracts";
import { RecentsService } from "./recents.service";

@Router({ alias: "recents" })
@UseMiddlewares(AuthMiddleware)
export class RecentsRouter {
	constructor(
		@Inject(RecentsService) private readonly recents: RecentsService,
	) {}

	@Query()
	async list(@Ctx() ctx: AuthedTrpcContext) {
		return this.recents.list(ctx.user.id);
	}

	@Mutation({ input: recentTouchInput })
	async touch(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof recentTouchInput>,
	) {
		return this.recents.touch(input, ctx.user.id);
	}
}
