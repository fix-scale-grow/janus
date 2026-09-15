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
	estimateLinkInput,
	estimatePdfFlagInput,
	estimatePhotosInput,
	estimateReorderInput,
	invoiceLinkInput,
	invoicePdfFlagInput,
	invoicePhotosInput,
	invoiceReorderInput,
	photoListInput,
	projectLinkInput,
	projectPhotosInput,
	projectStageInput,
} from "./photos.contracts";
import { PhotosService } from "./photos.service";

@Router({ alias: "photos" })
@UseMiddlewares(AuthMiddleware, AccessMiddleware)
export class PhotosRouter {
	constructor(@Inject(PhotosService) private readonly photos: PhotosService) {}

	@Query({
		input: photoListInput,
		meta: access("photos", "VIEW", { field: true }),
	})
	async list(
		@Input() input: z.infer<typeof photoListInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.list(input, ctx.access);
	}

	@Query({ input: estimatePhotosInput, meta: access("photos", "VIEW") })
	async forEstimate(
		@Input("estimateId") estimateId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.forEstimate(estimateId, ctx.access);
	}

	@Mutation({ input: estimateLinkInput, meta: access("photos", "EDIT") })
	async linkEstimate(
		@Input() input: z.infer<typeof estimateLinkInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.linkEstimate(input, ctx.access);
	}

	@Mutation({ input: estimateLinkInput, meta: access("photos", "EDIT") })
	async unlinkEstimate(
		@Input() input: z.infer<typeof estimateLinkInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.unlinkEstimate(input, ctx.access);
	}

	@Mutation({ input: estimatePdfFlagInput, meta: access("photos", "EDIT") })
	async setEstimatePdfFlag(
		@Input() input: z.infer<typeof estimatePdfFlagInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.setEstimatePdfFlag(input, ctx.access);
	}

	@Mutation({ input: estimateReorderInput, meta: access("photos", "EDIT") })
	async reorderEstimatePhotos(
		@Input() input: z.infer<typeof estimateReorderInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.reorderEstimatePhotos(input, ctx.access);
	}

	@Query({ input: invoicePhotosInput, meta: access("photos", "VIEW") })
	async forInvoice(
		@Input("invoiceId") invoiceId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.forInvoice(invoiceId, ctx.access);
	}

	@Mutation({ input: invoiceLinkInput, meta: access("photos", "EDIT") })
	async linkInvoice(
		@Input() input: z.infer<typeof invoiceLinkInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.linkInvoice(input, ctx.access);
	}

	@Mutation({ input: invoiceLinkInput, meta: access("photos", "EDIT") })
	async unlinkInvoice(
		@Input() input: z.infer<typeof invoiceLinkInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.unlinkInvoice(input, ctx.access);
	}

	@Mutation({ input: invoicePdfFlagInput, meta: access("photos", "EDIT") })
	async setInvoicePdfFlag(
		@Input() input: z.infer<typeof invoicePdfFlagInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.setInvoicePdfFlag(input, ctx.access);
	}

	@Mutation({ input: invoiceReorderInput, meta: access("photos", "EDIT") })
	async reorderInvoicePhotos(
		@Input() input: z.infer<typeof invoiceReorderInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.reorderInvoicePhotos(input, ctx.access);
	}

	@Query({
		input: projectPhotosInput,
		meta: access("photos", "VIEW", { field: true }),
	})
	async forProject(
		@Input("projectId") projectId: string,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.forProject(projectId, ctx.access);
	}

	@Mutation({
		input: projectLinkInput,
		meta: access("photos", "EDIT", { field: true }),
	})
	async linkProject(
		@Input() input: z.infer<typeof projectLinkInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.linkProject(input, ctx.access);
	}

	@Mutation({
		input: projectLinkInput,
		meta: access("photos", "EDIT", { field: true }),
	})
	async unlinkProject(
		@Input() input: z.infer<typeof projectLinkInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.unlinkProject(input, ctx.access);
	}

	@Mutation({
		input: projectStageInput,
		meta: access("photos", "EDIT", { field: true }),
	})
	async setProjectStage(
		@Input() input: z.infer<typeof projectStageInput>,
		@Ctx() ctx: AccessTrpcContext,
	) {
		return this.photos.setProjectStage(input, ctx.access);
	}
}
