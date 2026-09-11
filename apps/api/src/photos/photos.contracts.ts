import { z } from "zod";

export const photoListInput = z.object({
	dealId: z.string().optional(),
	contactId: z.string().optional(),
});

export type PhotoListInput = z.infer<typeof photoListInput>;

export const estimatePhotosInput = z.object({ estimateId: z.string().min(1) });

export type EstimatePhotosInput = z.infer<typeof estimatePhotosInput>;

export const estimateLinkInput = z.object({
	estimateId: z.string().min(1),
	photoId: z.string().min(1),
});

export type EstimateLinkInput = z.infer<typeof estimateLinkInput>;

export const estimatePdfFlagInput = estimateLinkInput.extend({
	includeInPdf: z.boolean(),
});

export type EstimatePdfFlagInput = z.infer<typeof estimatePdfFlagInput>;

export const estimateReorderInput = z.object({
	estimateId: z.string().min(1),
	photoIds: z.array(z.string().min(1)).max(500),
});

export type EstimateReorderInput = z.infer<typeof estimateReorderInput>;
