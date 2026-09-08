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
import { viewGetInput, viewResetInput, viewSaveInput } from "./views.contracts";
import { ViewsService } from "./views.service";

@Router({ alias: "views" })
@UseMiddlewares(AuthMiddleware)
export class ViewsRouter {
	constructor(@Inject(ViewsService) private readonly views: ViewsService) {}

	@Query({ input: viewGetInput })
	async get(
		@Input() input: z.infer<typeof viewGetInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.views.get(ctx.user.id, input.tableId);
	}

	@Mutation({ input: viewSaveInput })
	async save(
		@Input() input: z.infer<typeof viewSaveInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.views.save(ctx.user.id, input.tableId, input.state);
	}

	@Mutation({ input: viewResetInput })
	async reset(
		@Input() input: z.infer<typeof viewResetInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		await this.views.reset(ctx.user.id, input.tableId);
		return { ok: true };
	}
}
