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
import { viewGetInput, viewResetInput, viewSaveInput } from "./views.contracts";
import { ViewsService } from "./views.service";

@Router({ alias: "views" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ViewsRouter {
	constructor(@Inject(ViewsService) private readonly views: ViewsService) {}

	@Query({ input: viewGetInput, meta: anyMember({ field: true }) })
	async get(
		@Input() input: z.infer<typeof viewGetInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.views.get(ctx.user.id, input.tableId);
	}

	@Mutation({ input: viewSaveInput, meta: anyMember({ field: true }) })
	async save(
		@Input() input: z.infer<typeof viewSaveInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.views.save(ctx.user.id, input.tableId, input.state);
	}

	@Mutation({ input: viewResetInput, meta: anyMember({ field: true }) })
	async reset(
		@Input() input: z.infer<typeof viewResetInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		await this.views.reset(ctx.user.id, input.tableId);
		return { ok: true };
	}
}
