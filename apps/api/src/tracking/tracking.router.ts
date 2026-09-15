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
	addDomainInput,
	contactActivityInput,
	cookieLifetimeInput,
	removeDomainInput,
	trackingFlagInput,
	verifyInput,
} from "./tracking.contracts";
import { TrackingService } from "./tracking.service";

@Router({ alias: "tracking" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class TrackingRouter {
	constructor(
		@Inject(TrackingService) private readonly tracking: TrackingService,
	) {}

	@Query({ meta: adminOnly() })
	async settings(@Ctx() ctx: AuthedTrpcContext) {
		return this.tracking.settings(ctx.user.id);
	}

	@Mutation({ input: trackingFlagInput, meta: adminOnly() })
	async setFlag(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof trackingFlagInput>,
	) {
		return this.tracking.setFlag(ctx.user.id, input.flag, input.enabled);
	}

	@Mutation({ input: cookieLifetimeInput, meta: adminOnly() })
	async setCookieLifetime(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof cookieLifetimeInput>,
	) {
		return this.tracking.setCookieDays(ctx.user.id, input.days);
	}

	@Mutation({ input: addDomainInput, meta: adminOnly() })
	async addDomain(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof addDomainInput>,
	) {
		return this.tracking.addDomain(ctx.user.id, input);
	}

	@Mutation({ input: removeDomainInput, meta: adminOnly() })
	async removeDomain(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof removeDomainInput>,
	) {
		return this.tracking.removeDomain(ctx.user.id, input.id);
	}

	@Mutation({ meta: adminOnly() })
	async rotateSiteId(@Ctx() ctx: AuthedTrpcContext) {
		return this.tracking.rotateSiteId(ctx.user.id);
	}

	@Mutation({ input: verifyInput, meta: adminOnly() })
	async verify(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof verifyInput>,
	) {
		return this.tracking.verify(ctx.user.id, input.url);
	}

	@Query({ meta: adminOnly() })
	async sources(@Ctx() ctx: AuthedTrpcContext) {
		return this.tracking.sources(ctx.user.id);
	}

	@Query({ input: contactActivityInput, meta: adminOnly() })
	async contactActivity(@Input() input: z.infer<typeof contactActivityInput>) {
		return this.tracking.activityForContact(input.contactId);
	}
}
