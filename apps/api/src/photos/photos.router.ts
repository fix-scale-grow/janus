import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
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
@UseMiddlewares(AuthMiddleware)
export class PhotosRouter {
	constructor(@Inject(PhotosService) private readonly photos: PhotosService) {}

	@Query({ input: photoListInput })
	async list(@Input() input: z.infer<typeof photoListInput>) {
		return this.photos.list(input);
	}

	@Query({ input: estimatePhotosInput })
	async forEstimate(@Input("estimateId") estimateId: string) {
		return this.photos.forEstimate(estimateId);
	}

	@Mutation({ input: estimateLinkInput })
	async linkEstimate(@Input() input: z.infer<typeof estimateLinkInput>) {
		return this.photos.linkEstimate(input);
	}

	@Mutation({ input: estimateLinkInput })
	async unlinkEstimate(@Input() input: z.infer<typeof estimateLinkInput>) {
		return this.photos.unlinkEstimate(input);
	}

	@Mutation({ input: estimatePdfFlagInput })
	async setEstimatePdfFlag(
		@Input() input: z.infer<typeof estimatePdfFlagInput>,
	) {
		return this.photos.setEstimatePdfFlag(input);
	}

	@Mutation({ input: estimateReorderInput })
	async reorderEstimatePhotos(
		@Input() input: z.infer<typeof estimateReorderInput>,
	) {
		return this.photos.reorderEstimatePhotos(input);
	}

	@Query({ input: invoicePhotosInput })
	async forInvoice(@Input("invoiceId") invoiceId: string) {
		return this.photos.forInvoice(invoiceId);
	}

	@Mutation({ input: invoiceLinkInput })
	async linkInvoice(@Input() input: z.infer<typeof invoiceLinkInput>) {
		return this.photos.linkInvoice(input);
	}

	@Mutation({ input: invoiceLinkInput })
	async unlinkInvoice(@Input() input: z.infer<typeof invoiceLinkInput>) {
		return this.photos.unlinkInvoice(input);
	}

	@Mutation({ input: invoicePdfFlagInput })
	async setInvoicePdfFlag(@Input() input: z.infer<typeof invoicePdfFlagInput>) {
		return this.photos.setInvoicePdfFlag(input);
	}

	@Mutation({ input: invoiceReorderInput })
	async reorderInvoicePhotos(
		@Input() input: z.infer<typeof invoiceReorderInput>,
	) {
		return this.photos.reorderInvoicePhotos(input);
	}

	@Query({ input: projectPhotosInput })
	async forProject(@Input("projectId") projectId: string) {
		return this.photos.forProject(projectId);
	}

	@Mutation({ input: projectLinkInput })
	async linkProject(@Input() input: z.infer<typeof projectLinkInput>) {
		return this.photos.linkProject(input);
	}

	@Mutation({ input: projectLinkInput })
	async unlinkProject(@Input() input: z.infer<typeof projectLinkInput>) {
		return this.photos.unlinkProject(input);
	}

	@Mutation({ input: projectStageInput })
	async setProjectStage(@Input() input: z.infer<typeof projectStageInput>) {
		return this.photos.setProjectStage(input);
	}
}
