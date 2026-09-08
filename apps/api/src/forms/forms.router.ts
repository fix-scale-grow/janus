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
@UseMiddlewares(AuthMiddleware)
export class FormsRouter {
	constructor(@Inject(FormsService) private readonly forms: FormsService) {}

	@Query({ input: formListInput })
	async list(@Input() input: z.infer<typeof formListInput>) {
		return this.forms.list(input);
	}

	@Query({ input: formIdInput })
	async byId(@Input("id") id: string) {
		return this.forms.byId(id);
	}

	@Mutation({ input: formCreateInput })
	async create(
		@Input() input: z.infer<typeof formCreateInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.forms.create(input, ctx.user.id);
	}

	@Mutation({ input: formUpdateArgs })
	async update(@Input() input: z.infer<typeof formUpdateArgs>) {
		return this.forms.update(input.id, input.data);
	}

	@Mutation({ input: formUpdateFieldsInput })
	async updateFields(@Input() input: z.infer<typeof formUpdateFieldsInput>) {
		return this.forms.updateFields(input);
	}

	@Mutation({ input: formSetActiveInput })
	async setActive(@Input() input: z.infer<typeof formSetActiveInput>) {
		return this.forms.setActive(input.id, input.active);
	}

	@Mutation({ input: formIdInput })
	async remove(@Input("id") id: string) {
		return this.forms.remove(id);
	}

	@Query({ input: formSubmissionsInput })
	async submissions(@Input() input: z.infer<typeof formSubmissionsInput>) {
		return this.forms.submissions(input);
	}
}
