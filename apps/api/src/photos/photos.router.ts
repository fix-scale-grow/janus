import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	estimateLinkInput,
	estimatePdfFlagInput,
	estimatePhotosInput,
	estimateReorderInput,
	photoListInput,
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
}
