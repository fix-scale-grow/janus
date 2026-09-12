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
import {
	setAgentModelInput,
	setDealNumberStartInput,
	setNavLayoutInput,
	setResearchKeyInput,
} from "./settings.contracts";
import { SettingsService } from "./settings.service";

@Router({ alias: "settings" })
@UseMiddlewares(AuthMiddleware)
export class SettingsRouter {
	constructor(
		@Inject(SettingsService) private readonly settings: SettingsService,
	) {}

	@Query()
	async agentModel() {
		return this.settings.agentModel();
	}

	@Query()
	async modelCatalog() {
		return this.settings.modelCatalog();
	}

	@Mutation({ input: setAgentModelInput })
	async setAgentModel(@Input() input: z.infer<typeof setAgentModelInput>) {
		return this.settings.setAgentModel(input.modelId);
	}

	@Query()
	async researchKey() {
		return this.settings.researchKey();
	}

	@Mutation({ input: setResearchKeyInput })
	async setResearchKey(@Input() input: z.infer<typeof setResearchKeyInput>) {
		return this.settings.setResearchKey(input.apiKey);
	}

	@Query()
	async navLayout() {
		return this.settings.navLayout();
	}

	@Mutation({ input: setNavLayoutInput })
	async setNavLayout(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setNavLayoutInput>,
	) {
		return this.settings.setNavLayout(ctx.user.id, input.layout);
	}

	@Query()
	async dealNumbering() {
		return this.settings.dealNumbering();
	}

	@Mutation({ input: setDealNumberStartInput })
	async setDealNumberStart(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setDealNumberStartInput>,
	) {
		return this.settings.setDealNumberStart(ctx.user.id, input.start);
	}
}
