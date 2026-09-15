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
	templateByPurposeInput,
	templatePreviewInput,
	templateSendTestInput,
	templateUpdateInput,
} from "./templates.contracts";
import { TemplatesService } from "./templates.service";

@Router({ alias: "templates" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class TemplatesRouter {
	constructor(
		@Inject(TemplatesService) private readonly templates: TemplatesService,
	) {}

	@Query({ meta: anyMember() })
	async list() {
		return this.templates.list();
	}

	@Query({ input: templateByPurposeInput, meta: anyMember() })
	async byPurpose(@Input() input: z.infer<typeof templateByPurposeInput>) {
		return this.templates.byPurpose(input);
	}

	@Mutation({ input: templateUpdateInput, meta: adminOnly() })
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof templateUpdateInput>,
	) {
		return this.templates.update(input, ctx.user.id);
	}

	@Query({ input: templatePreviewInput, meta: anyMember() })
	async preview(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof templatePreviewInput>,
	) {
		return this.templates.preview(input, ctx.user.name);
	}

	@Mutation({ input: templateSendTestInput, meta: adminOnly() })
	async sendTest(@Input() input: z.infer<typeof templateSendTestInput>) {
		return this.templates.sendTest(input);
	}

	@Query({ meta: anyMember() })
	async mailerConfigured() {
		return this.templates.mailerConfigured();
	}

	@Query({ meta: anyMember() })
	async mergeFields() {
		return this.templates.mergeFields();
	}
}
