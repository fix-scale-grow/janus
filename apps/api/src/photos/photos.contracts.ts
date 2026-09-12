import { ProjectPhotoStage } from "@crm/db";
import { z } from "zod";

const projectPhotoStageEnum = z.enum(
	Object.values(ProjectPhotoStage) as [
		ProjectPhotoStage,
		...ProjectPhotoStage[],
	],
);

export const photoListInput = z.object({
	dealId: z.string().optional(),
	contactId: z.string().optional(),
	includeDealContacts: z.boolean().optional(),
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

export const invoicePhotosInput = z.object({ invoiceId: z.string().min(1) });

export type InvoicePhotosInput = z.infer<typeof invoicePhotosInput>;

export const invoiceLinkInput = z.object({
	invoiceId: z.string().min(1),
	photoId: z.string().min(1),
});

export type InvoiceLinkInput = z.infer<typeof invoiceLinkInput>;

export const invoicePdfFlagInput = invoiceLinkInput.extend({
	includeInPdf: z.boolean(),
});

export type InvoicePdfFlagInput = z.infer<typeof invoicePdfFlagInput>;

export const invoiceReorderInput = z.object({
	invoiceId: z.string().min(1),
	photoIds: z.array(z.string().min(1)).max(500),
});

export type InvoiceReorderInput = z.infer<typeof invoiceReorderInput>;

export const projectPhotosInput = z.object({ projectId: z.string().min(1) });

export type ProjectPhotosInput = z.infer<typeof projectPhotosInput>;

export const projectLinkInput = z.object({
	projectId: z.string().min(1),
	photoId: z.string().min(1),
});

export type ProjectLinkInput = z.infer<typeof projectLinkInput>;

export const projectStageInput = projectLinkInput.extend({
	stageLabel: projectPhotoStageEnum,
});

export type ProjectStageInput = z.infer<typeof projectStageInput>;
