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
import { access, anyMember } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	dealAttachContactInput,
	dealBulkInput,
	dealBulkOwnerInput,
	dealBulkStageInput,
	dealContactRoleInput,
	dealContactsInput,
	dealCreateInput,
	dealDetachContactInput,
	dealIdInput,
	dealListInput,
	dealUpdateArgs,
	setProductionStageInput,
	setStageInput,
} from "./deals.contracts";
import { DealsService } from "./deals.service";

@Router({ alias: "deals" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class DealsRouter {
	constructor(@Inject(DealsService) private readonly deals: DealsService) {}

	@Query({ input: dealListInput, meta: access("deals", "VIEW") })
	async list(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealListInput>,
	) {
		return this.deals.list(input, ctx.access);
	}

	@Query({ input: dealIdInput, meta: access("deals", "VIEW") })
	async byId(@Ctx() ctx: AccessTrpcContext, @Input("id") id: string) {
		return this.deals.byId(id, ctx.access);
	}

	@Query({ meta: anyMember({ field: true }) })
	async fieldToday(@Ctx() ctx: AccessTrpcContext) {
		return this.deals.fieldToday(ctx.access);
	}

	@Mutation({ input: dealCreateInput, meta: access("deals", "EDIT") })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealCreateInput>,
	) {
		return this.deals.create(input, ctx.access);
	}

	@Mutation({ input: dealUpdateArgs, meta: access("deals", "EDIT") })
	async update(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealUpdateArgs>,
	) {
		return this.deals.update(input.id, input.data, ctx.access);
	}

	@Mutation({ input: dealIdInput, meta: access("deals", "DELETE") })
	async delete(@Ctx() ctx: AccessTrpcContext, @Input("id") id: string) {
		return this.deals.delete(id, ctx.access);
	}

	@Mutation({ input: setStageInput, meta: access("deals", "EDIT") })
	async setStage(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof setStageInput>,
	) {
		return this.deals.setStage(input, ctx.user.id, ctx.access);
	}

	@Mutation({
		input: setProductionStageInput,
		meta: access("deals", ["EDIT", "deals.markComplete"], { field: true }),
	})
	async setProductionStage(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof setProductionStageInput>,
	) {
		return this.deals.setProductionStage(input, ctx.user.id, ctx.access);
	}

	@Query({ input: dealContactsInput, meta: access("deals", "VIEW") })
	async contactOptions(
		@Ctx() ctx: AccessTrpcContext,
		@Input("dealId") dealId: string,
	) {
		return this.deals.contactOptions(dealId, ctx.access);
	}

	@Mutation({ input: dealAttachContactInput, meta: access("deals", "EDIT") })
	async attachContact(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealAttachContactInput>,
	) {
		return this.deals.attachContact(input, ctx.access);
	}

	@Mutation({ input: dealDetachContactInput, meta: access("deals", "EDIT") })
	async detachContact(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealDetachContactInput>,
	) {
		return this.deals.detachContact(input, ctx.access);
	}

	@Mutation({ input: dealContactRoleInput, meta: access("deals", "EDIT") })
	async setContactRole(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealContactRoleInput>,
	) {
		return this.deals.setContactRole(input, ctx.access);
	}

	@Mutation({ input: dealBulkOwnerInput, meta: access("deals", "EDIT") })
	async bulkAssignOwner(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealBulkOwnerInput>,
	) {
		return this.deals.bulkAssignOwner(input, ctx.access);
	}

	@Mutation({ input: dealBulkStageInput, meta: access("deals", "EDIT") })
	async bulkSetStage(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof dealBulkStageInput>,
	) {
		return this.deals.bulkSetStage(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: dealBulkInput, meta: access("deals", "DELETE") })
	async bulkDelete(@Ctx() ctx: AccessTrpcContext, @Input("ids") ids: string[]) {
		return this.deals.bulkDelete(ids, ctx.access);
	}
}
