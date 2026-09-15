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
import type { AuthedTrpcContext } from "../trpc/context.types";
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
	async list(@Input() input: z.infer<typeof dealListInput>) {
		return this.deals.list(input);
	}

	@Query({ input: dealIdInput, meta: access("deals", "VIEW") })
	async byId(@Input("id") id: string) {
		return this.deals.byId(id);
	}

	@Query({ meta: anyMember({ field: true }) })
	async fieldToday() {
		return this.deals.fieldToday();
	}

	@Mutation({ input: dealCreateInput, meta: access("deals", "EDIT") })
	async create(@Input() input: z.infer<typeof dealCreateInput>) {
		return this.deals.create(input);
	}

	@Mutation({ input: dealUpdateArgs, meta: access("deals", "EDIT") })
	async update(@Input() input: z.infer<typeof dealUpdateArgs>) {
		return this.deals.update(input.id, input.data);
	}

	@Mutation({ input: dealIdInput, meta: access("deals", "DELETE") })
	async delete(@Input("id") id: string) {
		return this.deals.delete(id);
	}

	@Mutation({ input: setStageInput, meta: access("deals", "EDIT") })
	async setStage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setStageInput>,
	) {
		return this.deals.setStage(input, ctx.user.id);
	}

	@Mutation({
		input: setProductionStageInput,
		meta: access("deals", ["EDIT", "deals.markComplete"], { field: true }),
	})
	async setProductionStage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setProductionStageInput>,
	) {
		return this.deals.setProductionStage(input, ctx.user.id);
	}

	@Query({ input: dealContactsInput, meta: access("deals", "VIEW") })
	async contactOptions(@Input("dealId") dealId: string) {
		return this.deals.contactOptions(dealId);
	}

	@Mutation({ input: dealAttachContactInput, meta: access("deals", "EDIT") })
	async attachContact(@Input() input: z.infer<typeof dealAttachContactInput>) {
		return this.deals.attachContact(input);
	}

	@Mutation({ input: dealDetachContactInput, meta: access("deals", "EDIT") })
	async detachContact(@Input() input: z.infer<typeof dealDetachContactInput>) {
		return this.deals.detachContact(input);
	}

	@Mutation({ input: dealContactRoleInput, meta: access("deals", "EDIT") })
	async setContactRole(@Input() input: z.infer<typeof dealContactRoleInput>) {
		return this.deals.setContactRole(input);
	}

	@Mutation({ input: dealBulkOwnerInput, meta: access("deals", "EDIT") })
	async bulkAssignOwner(@Input() input: z.infer<typeof dealBulkOwnerInput>) {
		return this.deals.bulkAssignOwner(input);
	}

	@Mutation({ input: dealBulkStageInput, meta: access("deals", "EDIT") })
	async bulkSetStage(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dealBulkStageInput>,
	) {
		return this.deals.bulkSetStage(input, ctx.user.id);
	}

	@Mutation({ input: dealBulkInput, meta: access("deals", "DELETE") })
	async bulkDelete(@Input("ids") ids: string[]) {
		return this.deals.bulkDelete(ids);
	}
}
