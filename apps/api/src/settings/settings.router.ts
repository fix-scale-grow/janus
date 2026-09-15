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
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	setAgentModelInput,
	setDealNumberStartInput,
	setDocumentChromeInput,
	setNavLayoutInput,
	setPermitsInput,
	setResearchKeyInput,
} from "./settings.contracts";
import { SettingsService } from "./settings.service";

@Router({ alias: "settings" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class SettingsRouter {
	constructor(
		@Inject(SettingsService) private readonly settings: SettingsService,
	) {}

	@Query({ meta: anyMember() })
	async agentModel() {
		return this.settings.agentModel();
	}

	@Query({ meta: anyMember() })
	async modelCatalog() {
		return this.settings.modelCatalog();
	}

	@Mutation({ input: setAgentModelInput, meta: anyMember() })
	async setAgentModel(@Input() input: z.infer<typeof setAgentModelInput>) {
		return this.settings.setAgentModel(input.modelId);
	}

	@Query({ meta: anyMember() })
	async researchKey() {
		return this.settings.researchKey();
	}

	@Mutation({ input: setResearchKeyInput, meta: anyMember() })
	async setResearchKey(@Input() input: z.infer<typeof setResearchKeyInput>) {
		return this.settings.setResearchKey(input.apiKey);
	}

	@Query({ meta: anyMember() })
	async documentChrome() {
		return this.settings.documentChrome();
	}

	@Mutation({ input: setDocumentChromeInput, meta: adminOnly() })
	async setDocumentChrome(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setDocumentChromeInput>,
	) {
		return this.settings.setDocumentChrome(ctx.user.id, input);
	}

	@Query({ meta: anyMember() })
	async navLayout() {
		return this.settings.navLayout();
	}

	@Mutation({ input: setNavLayoutInput, meta: adminOnly() })
	async setNavLayout(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setNavLayoutInput>,
	) {
		return this.settings.setNavLayout(ctx.user.id, input.layout);
	}

	@Query({ meta: anyMember() })
	async dealNumbering() {
		return this.settings.dealNumbering();
	}

	@Mutation({ input: setDealNumberStartInput, meta: adminOnly() })
	async setDealNumberStart(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setDealNumberStartInput>,
	) {
		return this.settings.setDealNumberStart(ctx.user.id, input.start);
	}

	@Query({ meta: anyMember() })
	async permits() {
		return this.settings.permits();
	}

	@Mutation({ input: setPermitsInput, meta: adminOnly() })
	async setPermits(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setPermitsInput>,
	) {
		return this.settings.setPermits(ctx.user.id, {
			enabled: input.enabled,
			states: input.states,
			triggerStageIds: input.triggerStageIds,
		});
	}

	@Mutation({ meta: anyMember() })
	async acceptPermitDisclaimer(@Ctx() ctx: AuthedTrpcContext) {
		return this.settings.acceptPermitDisclaimer(ctx.user.id);
	}
}
