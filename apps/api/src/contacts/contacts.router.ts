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
import type { AuthedTrpcContext } from "../trpc/context.types";
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
	async list(@Input() input: z.infer<typeof contactListInput>) {
		return this.contacts.list(input);
	}

	@Query({ input: contactIdInput, meta: access("contacts", "VIEW") })
	async byId(@Input("id") id: string) {
		return this.contacts.byId(id);
	}

	@Query({ input: contactOptionsInput, meta: access("contacts", "VIEW") })
	async options(@Input("q") q: string) {
		return this.contacts.options(q);
	}

	@Mutation({ input: contactCreateInput, meta: access("contacts", "EDIT") })
	async create(@Input() input: z.infer<typeof contactCreateInput>) {
		return this.contacts.create(input);
	}

	@Mutation({ input: contactUpdateArgs, meta: access("contacts", "EDIT") })
	async update(@Input() input: z.infer<typeof contactUpdateArgs>) {
		return this.contacts.update(input.id, input.data);
	}

	@Mutation({ input: contactIdInput, meta: access("contacts", "DELETE") })
	async delete(@Input("id") id: string) {
		return this.contacts.delete(id);
	}

	@Mutation({ input: contactIdInput, meta: access("contacts", "EDIT") })
	async enrich(@Input("id") id: string) {
		return this.contacts.enrich(id);
	}

	@Mutation({ input: contactBulkOwnerInput, meta: access("contacts", "EDIT") })
	async bulkAssignOwner(@Input() input: z.infer<typeof contactBulkOwnerInput>) {
		return this.contacts.bulkAssignOwner(input);
	}

	@Mutation({ input: contactBulkInput, meta: access("contacts", "EDIT") })
	async bulkEnrich(@Input("ids") ids: string[]) {
		return this.contacts.bulkEnrich(ids);
	}

	@Mutation({ input: contactBulkInput, meta: access("contacts", "DELETE") })
	async bulkDelete(@Input("ids") ids: string[]) {
		return this.contacts.bulkDelete(ids);
	}

	@Mutation({ input: factDecisionInput, meta: access("contacts", "EDIT") })
	async decideFact(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof factDecisionInput>,
	) {
		return this.contacts.decideFact(input, ctx.user.id);
	}
}
