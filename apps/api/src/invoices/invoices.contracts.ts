import { InvoiceStatus } from "@crm/db";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

const statusEnum = z.enum(
	Object.values(InvoiceStatus) as [InvoiceStatus, ...InvoiceStatus[]],
);

const tierEnum = z.enum(["GOOD", "BETTER", "BEST"]);

const cents = z.number().int().min(0).max(99_999_999);

const quantity = z
	.number()
	.min(0)
	.max(9_999_999.99, "That quantity is too large.");

export const invoiceListInput = listInput.extend({
	dealId: z.string().optional(),
	contactId: z.string().optional(),
	estimateId: z.string().optional(),
	status: statusEnum.optional(),
});

export type InvoiceListInput = z.infer<typeof invoiceListInput>;

export const invoiceIdInput = z.object({ id: z.string().min(1) });

export type InvoiceIdInput = z.infer<typeof invoiceIdInput>;

export const invoiceCreateInput = z.object({
	dealId: z.string().optional(),
	contactId: z.string().optional(),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateInput>;

export const invoiceCreateFromEstimateInput = z.object({
	estimateId: z.string().min(1),
	tier: tierEnum.optional(),
});

export type InvoiceCreateFromEstimateInput = z.infer<
	typeof invoiceCreateFromEstimateInput
>;

export const invoiceSetStatusInput = z.object({
	id: z.string().min(1),
	status: statusEnum,
});

export type InvoiceSetStatusInput = z.infer<typeof invoiceSetStatusInput>;

export const invoiceUpdateInput = z.object({
	id: z.string().min(1),
	data: z.object({
		notes: z.string().trim().max(5000).nullable().optional(),
		dueAt: z.date().nullable().optional(),
		issuedAt: z.date().nullable().optional(),
		contactId: z.string().nullable().optional(),
	}),
});

export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateInput>;

export const invoiceAddLineItemInput = z.object({
	invoiceId: z.string().min(1),
	name: z.string().trim().min(1).max(200),
	unit: z.enum(["PER_SQUARE", "PER_LINEAR_FT", "PER_EACH", "FLAT"]),
	quantity: quantity.default(1),
	priceCents: cents.default(0),
	areaLabel: z.string().trim().max(120).optional(),
});

export type InvoiceAddLineItemInput = z.infer<typeof invoiceAddLineItemInput>;

export const invoiceUpdateLineItemFields = z.object({
	name: z.string().trim().min(1).max(200).optional(),
	quantity: quantity.optional(),
	priceCents: cents.optional(),
	areaLabel: z.string().trim().max(120).nullable().optional(),
	sortOrder: z.number().int().optional(),
});

export const invoiceUpdateLineItemInput = z.object({
	id: z.string().min(1),
	data: invoiceUpdateLineItemFields,
});

export type InvoiceUpdateLineItemInput = z.infer<
	typeof invoiceUpdateLineItemInput
>;

export const invoiceLineItemIdInput = z.object({ id: z.string().min(1) });

export type InvoiceLineItemIdInput = z.infer<typeof invoiceLineItemIdInput>;
