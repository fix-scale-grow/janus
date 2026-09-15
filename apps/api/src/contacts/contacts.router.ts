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
import { access } from "../access/access.meta";
import { AccessMiddleware } from "../access/access.middleware";
import type { AccessTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	contactBulkInput,
	contactBulkOwnerInput,
	contactCreateInput,
	contactIdInput,
	contactListInput,
	contactOptionsInput,
	contactUpdateArgs,
	factDecisionInput,
} from "./contacts.contracts";
import { ContactsService } from "./contacts.service";

@Router({ alias: "contacts" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class ContactsRouter {
	constructor(
		@Inject(ContactsService) private readonly contacts: ContactsService,
	) {}

	@Query({ input: contactListInput, meta: access("contacts", "VIEW") })
	async list(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof contactListInput>,
	) {
		return this.contacts.list(input, ctx.access);
	}

	@Query({ input: contactIdInput, meta: access("contacts", "VIEW") })
	async byId(@Ctx() ctx: AccessTrpcContext, @Input("id") id: string) {
		return this.contacts.byId(id, ctx.access);
	}

	@Query({ input: contactOptionsInput, meta: access("contacts", "VIEW") })
	async options(@Ctx() ctx: AccessTrpcContext, @Input("q") q: string) {
		return this.contacts.options(q, ctx.access);
	}

	@Mutation({ input: contactCreateInput, meta: access("contacts", "EDIT") })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof contactCreateInput>,
	) {
		return this.contacts.create(input, ctx.access);
	}

	@Mutation({ input: contactUpdateArgs, meta: access("contacts", "EDIT") })
	async update(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof contactUpdateArgs>,
	) {
		return this.contacts.update(input.id, input.data, ctx.access);
	}

	@Mutation({ input: contactIdInput, meta: access("contacts", "DELETE") })
	async delete(@Ctx() ctx: AccessTrpcContext, @Input("id") id: string) {
		return this.contacts.delete(id, ctx.access);
	}

	@Mutation({ input: contactBulkOwnerInput, meta: access("contacts", "EDIT") })
	async bulkAssignOwner(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof contactBulkOwnerInput>,
	) {
		return this.contacts.bulkAssignOwner(input, ctx.access);
	}

	@Mutation({ input: contactBulkInput, meta: access("contacts", "DELETE") })
	async bulkDelete(@Ctx() ctx: AccessTrpcContext, @Input("ids") ids: string[]) {
		return this.contacts.bulkDelete(ids, ctx.access);
	}

	@Mutation({ input: factDecisionInput, meta: access("contacts", "EDIT") })
	async decideFact(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof factDecisionInput>,
	) {
		return this.contacts.decideFact(input, ctx.user.id, ctx.access);
	}
}
