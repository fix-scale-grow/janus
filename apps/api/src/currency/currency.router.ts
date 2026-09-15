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
	removeManualRateInput,
	setManualRateInput,
	setReportingCurrencyInput,
} from "./currency.contracts";
import { CurrencyService } from "./currency.service";

@Router({ alias: "currency" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class CurrencyRouter {
	constructor(
		@Inject(CurrencyService) private readonly currency: CurrencyService,
	) {}

	@Query({ meta: anyMember() })
	async settings(@Ctx() ctx: AuthedTrpcContext) {
		return this.currency.settings(ctx.user.id);
	}

	@Mutation({ input: setReportingCurrencyInput, meta: adminOnly() })
	async setReportingCurrency(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setReportingCurrencyInput>,
	) {
		return this.currency.setReportingCurrency(ctx.user.id, input.currency);
	}

	@Mutation({ input: setManualRateInput, meta: adminOnly() })
	async setManualRate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setManualRateInput>,
	) {
		return this.currency.setManualRate(ctx.user.id, input.currency, input.rate);
	}

	@Mutation({ input: removeManualRateInput, meta: adminOnly() })
	async removeManualRate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof removeManualRateInput>,
	) {
		return this.currency.removeManualRate(ctx.user.id, input.currency);
	}

	@Mutation({ meta: adminOnly() })
	async refreshRates(@Ctx() ctx: AuthedTrpcContext) {
		return this.currency.refresh(ctx.user.id);
	}
}
