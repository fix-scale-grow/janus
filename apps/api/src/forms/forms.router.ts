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
	formCreateInput,
	formIdInput,
	formListInput,
	formSetActiveInput,
	formSubmissionsInput,
	formUpdateArgs,
	formUpdateFieldsInput,
} from "./forms.contracts";
import { FormsService } from "./forms.service";

@Router({ alias: "forms" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class FormsRouter {
	constructor(@Inject(FormsService) private readonly forms: FormsService) {}

	@Query({ input: formListInput, meta: access("forms", "VIEW") })
	async list(@Input() input: z.infer<typeof formListInput>) {
		return this.forms.list(input);
	}

	@Query({ input: formIdInput, meta: access("forms", "VIEW") })
	async byId(@Input("id") id: string) {
		return this.forms.byId(id);
	}

	@Mutation({ input: formCreateInput, meta: access("forms", "EDIT") })
	async create(
		@Input() input: z.infer<typeof formCreateInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.forms.create(input, ctx.user.id);
	}

	@Mutation({ input: formUpdateArgs, meta: access("forms", "EDIT") })
	async update(@Input() input: z.infer<typeof formUpdateArgs>) {
		return this.forms.update(input.id, input.data);
	}

	@Mutation({ input: formUpdateFieldsInput, meta: access("forms", "EDIT") })
	async updateFields(@Input() input: z.infer<typeof formUpdateFieldsInput>) {
		return this.forms.updateFields(input);
	}

	@Mutation({ input: formSetActiveInput, meta: access("forms", "EDIT") })
	async setActive(@Input() input: z.infer<typeof formSetActiveInput>) {
		return this.forms.setActive(input.id, input.active);
	}

	@Mutation({ input: formIdInput, meta: access("forms", "DELETE") })
	async remove(@Input("id") id: string) {
		return this.forms.remove(id);
	}

	@Query({ input: formSubmissionsInput, meta: access("forms", "VIEW") })
	async submissions(@Input() input: z.infer<typeof formSubmissionsInput>) {
		return this.forms.submissions(input);
	}
}
