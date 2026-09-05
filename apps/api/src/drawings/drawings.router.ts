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
	drawingAttachInput,
	drawingCreateInput,
	drawingIdInput,
	drawingListInput,
	drawingRenameInput,
	drawingRestoreVersionInput,
	drawingSaveSceneInput,
	drawingSetThumbnailInput,
} from "./drawings.contracts";
import { DrawingsService } from "./drawings.service";

@Router({ alias: "drawings" })
@UseMiddlewares(AuthMiddleware)
export class DrawingsRouter {
	constructor(
		@Inject(DrawingsService) private readonly drawings: DrawingsService,
	) {}

	@Query({ input: drawingListInput })
	async list(@Input() input: z.infer<typeof drawingListInput>) {
		return this.drawings.list(input);
	}

	@Query({ input: drawingIdInput })
	async byId(@Input("id") id: string) {
		return this.drawings.byId(id);
	}

	@Mutation({ input: drawingCreateInput })
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof drawingCreateInput>,
	) {
		return this.drawings.create(input, ctx.user.id);
	}

	@Mutation({ input: drawingSaveSceneInput })
	async saveScene(@Input() input: z.infer<typeof drawingSaveSceneInput>) {
		return this.drawings.saveScene(input);
	}

	@Mutation({ input: drawingRenameInput })
	async rename(@Input() input: z.infer<typeof drawingRenameInput>) {
		return this.drawings.rename(input);
	}

	@Mutation({ input: drawingAttachInput })
	async attach(@Input() input: z.infer<typeof drawingAttachInput>) {
		return this.drawings.attach(input);
	}

	@Mutation({ input: drawingIdInput })
	async delete(@Input("id") id: string) {
		return this.drawings.delete(id);
	}

	@Query({ input: drawingIdInput })
	async versions(@Input("id") id: string) {
		return this.drawings.versions(id);
	}

	@Mutation({ input: drawingRestoreVersionInput })
	async restoreVersion(
		@Input() input: z.infer<typeof drawingRestoreVersionInput>,
	) {
		return this.drawings.restoreVersion(input);
	}

	@Mutation({ input: drawingSetThumbnailInput })
	async setThumbnail(@Input() input: z.infer<typeof drawingSetThumbnailInput>) {
		return this.drawings.setThumbnail(input);
	}
}
