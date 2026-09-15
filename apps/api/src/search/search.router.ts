import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import { z } from "zod";
import { anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { SearchService } from "./search.service";

const quickInput = z.object({ q: z.string().default("") });

@Router({ alias: "search" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class SearchRouter {
	constructor(@Inject(SearchService) private readonly search: SearchService) {}

	@Query({ input: quickInput, meta: anyMember() })
	async quick(@Ctx() ctx: AccessTrpcContext, @Input("q") q: string) {
		return this.search.quick(q, ctx.access);
	}
}
