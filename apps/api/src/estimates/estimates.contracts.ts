import { EstimateStatus, EstimateTier } from "@crm/db";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

const statusEnum = z.enum(
	Object.values(EstimateStatus) as [EstimateStatus, ...EstimateStatus[]],
);

const tierEnum = z.enum(
	Object.values(EstimateTier) as [EstimateTier, ...EstimateTier[]],
);

const cents = z.number().int().min(0).max(99_999_999);

export const estimateListInput = listInput.extend({
	dealId: z.string().optional(),
	status: statusEnum.optional(),
});

export type EstimateListInput = z.infer<typeof estimateListInput>;

export const estimateIdInput = z.object({ id: z.string().min(1) });

export type EstimateIdInput = z.infer<typeof estimateIdInput>;

export const estimateCreateInput = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	dealId: z.string().optional(),
	contactId: z.string().optional(),
});

export type EstimateCreateInput = z.infer<typeof estimateCreateInput>;

export const estimateRenameInput = z.object({
	id: z.string().min(1),
	title: z.string().trim().min(1, "An estimate needs a name.").max(200),
});

export type EstimateRenameInput = z.infer<typeof estimateRenameInput>;

export const estimateSetStatusInput = z.object({
	id: z.string().min(1),
	status: statusEnum,
});

export type EstimateSetStatusInput = z.infer<typeof estimateSetStatusInput>;

export const estimateSetTierInput = z.object({
	id: z.string().min(1),
	tier: tierEnum,
});

export type EstimateSetTierInput = z.infer<typeof estimateSetTierInput>;

export const estimateAddLineItemInput = z
	.object({
		estimateId: z.string().min(1),
		serviceId: z.string().min(1).optional(),
		name: z.string().trim().min(1).max(200).optional(),
		unit: z
			.enum(["PER_SQUARE", "PER_LINEAR_FT", "PER_EACH", "FLAT"])
			.optional(),
		quantity: z.number().min(0).default(1),
		areaLabel: z.string().trim().max(120).optional(),
	})
	.refine((value) => value.serviceId || (value.name && value.unit), {
		message: "A line item needs a service, or a name and unit.",
	});

export type EstimateAddLineItemInput = z.infer<typeof estimateAddLineItemInput>;

export const estimateUpdateLineItemFields = z.object({
	name: z.string().trim().min(1).max(200).optional(),
	quantity: z.number().min(0).optional(),
	priceGoodCents: cents.optional(),
	priceBetterCents: cents.optional(),
	priceBestCents: cents.optional(),
	areaLabel: z.string().trim().max(120).nullable().optional(),
	sortOrder: z.number().int().optional(),
});

export const estimateUpdateLineItemInput = z.object({
	id: z.string().min(1),
	data: estimateUpdateLineItemFields,
});

export type EstimateUpdateLineItemInput = z.infer<
	typeof estimateUpdateLineItemInput
>;

export const estimateLineItemIdInput = z.object({ id: z.string().min(1) });

export type EstimateLineItemIdInput = z.infer<typeof estimateLineItemIdInput>;

export const estimateGenerateFromDrawingInput = z.object({
	drawingId: z.string().min(1),
});

export type EstimateGenerateFromDrawingInput = z.infer<
	typeof estimateGenerateFromDrawingInput
>;
