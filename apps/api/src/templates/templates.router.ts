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
	templateByPurposeInput,
	templatePreviewInput,
	templateSendTestInput,
	templateUpdateInput,
} from "./templates.contracts";
import { TemplatesService } from "./templates.service";

@Router({ alias: "templates" })
@UseMiddlewares(AuthMiddleware)
export class TemplatesRouter {
	constructor(
		@Inject(TemplatesService) private readonly templates: TemplatesService,
	) {}

	@Query()
	async list() {
		return this.templates.list();
	}

	@Query({ input: templateByPurposeInput })
	async byPurpose(@Input() input: z.infer<typeof templateByPurposeInput>) {
		return this.templates.byPurpose(input);
	}

	@Mutation({ input: templateUpdateInput })
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof templateUpdateInput>,
	) {
		return this.templates.update(input, ctx.user.id);
	}

	@Query({ input: templatePreviewInput })
	async preview(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof templatePreviewInput>,
	) {
		return this.templates.preview(input, ctx.user.name);
	}

	@Mutation({ input: templateSendTestInput })
	async sendTest(@Input() input: z.infer<typeof templateSendTestInput>) {
		return this.templates.sendTest(input);
	}

	@Query()
	async mailerConfigured() {
		return this.templates.mailerConfigured();
	}

	@Query()
	async mergeFields() {
		return this.templates.mergeFields();
	}
}
