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
	drawingAttachInput,
	drawingCreateInput,
	drawingIdInput,
	drawingListInput,
	drawingMoveInput,
	drawingRenameInput,
	drawingRestoreVersionInput,
	drawingSaveSceneInput,
	drawingSetThumbnailInput,
	folderCreateInput,
	folderRenameInput,
} from "./drawings.contracts";
import { DrawingsService } from "./drawings.service";

@Router({ alias: "drawings" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class DrawingsRouter {
	constructor(
		@Inject(DrawingsService) private readonly drawings: DrawingsService,
	) {}

	@Query({ input: drawingListInput, meta: access("drawings", "VIEW") })
	async list(
		@Input() input: z.infer<typeof drawingListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.drawings.list(input, ctx.access);
	}

	@Query({ input: drawingIdInput, meta: access("drawings", "VIEW") })
	async byId(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.drawings.byId(id, ctx.access);
	}

	@Mutation({ input: drawingCreateInput, meta: access("drawings", "EDIT") })
	async create(
		@Ctx() ctx: AccessTrpcContext,
		@Input() input: z.infer<typeof drawingCreateInput>,
	) {
		return this.drawings.create(input, ctx.user.id, ctx.access);
	}

	@Mutation({ input: drawingSaveSceneInput, meta: access("drawings", "EDIT") })
	async saveScene(
		@Input() input: z.infer<typeof drawingSaveSceneInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.drawings.saveScene(input, ctx.access);
	}

	@Mutation({ input: drawingRenameInput, meta: access("drawings", "EDIT") })
	async rename(
		@Input() input: z.infer<typeof drawingRenameInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.drawings.rename(input, ctx.access);
	}

	@Mutation({ input: drawingAttachInput, meta: access("drawings", "EDIT") })
	async attach(
		@Input() input: z.infer<typeof drawingAttachInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.drawings.attach(input, ctx.access);
	}

	@Mutation({ input: drawingIdInput, meta: access("drawings", "DELETE") })
	async delete(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.drawings.delete(id, ctx.access);
	}

	@Query({ meta: access("drawings", "VIEW") })
	async folders(@Ctx() ctx: AccessTrpcContext) {
		return this.drawings.folders(ctx.access);
	}

	@Mutation({ input: folderCreateInput, meta: access("drawings", "EDIT") })
	async createFolder(@Input() input: z.infer<typeof folderCreateInput>) {
		return this.drawings.createFolder(input);
	}

	@Mutation({ input: folderRenameInput, meta: access("drawings", "EDIT") })
	async renameFolder(@Input() input: z.infer<typeof folderRenameInput>) {
		return this.drawings.renameFolder(input);
	}

	@Mutation({ input: drawingIdInput, meta: access("drawings", "DELETE") })
	async deleteFolder(@Input("id") id: string) {
		return this.drawings.deleteFolder(id);
	}

	@Mutation({ input: drawingMoveInput, meta: access("drawings", "EDIT") })
	async move(
		@Input() input: z.infer<typeof drawingMoveInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.drawings.move(input, ctx.access);
	}

	@Query({ input: drawingIdInput, meta: access("drawings", "VIEW") })
	async versions(@Input("id") id: string, @Ctx() ctx: AccessTrpcContext) {
		return this.drawings.versions(id, ctx.access);
	}

	@Mutation({
		input: drawingRestoreVersionInput,
		meta: access("drawings", "EDIT"),
	})
	async restoreVersion(
		@Input() input: z.infer<typeof drawingRestoreVersionInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.drawings.restoreVersion(input, ctx.access);
	}

	@Mutation({
		input: drawingSetThumbnailInput,
		meta: access("drawings", "EDIT"),
	})
	async setThumbnail(
		@Input() input: z.infer<typeof drawingSetThumbnailInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.drawings.setThumbnail(input, ctx.access);
	}
}
