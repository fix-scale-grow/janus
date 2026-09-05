import { ServiceUnit } from "@crm/db";
import type { ServiceModifier } from "@crm/drawings";
import { serviceModifier } from "@crm/drawings";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

const unitEnum = z.enum(
	Object.values(ServiceUnit) as [ServiceUnit, ...ServiceUnit[]],
);

const cents = z.number().int().min(0).max(99_999_999);

const modifierField: z.ZodOptional<z.ZodNullable<z.ZodType<ServiceModifier>>> =
	serviceModifier.nullish();

export const serviceFields = z.object({
	name: z.string().trim().min(1, "A service needs a name.").max(200),
	trade: z.string().trim().min(1).max(60).default("roofing"),
	unit: unitEnum,
	unitPriceCents: cents,
	costCents: cents.nullish(),
	priceGoodCents: cents.nullish(),
	priceBestCents: cents.nullish(),
	modifier: modifierField,
	symbolId: z.string().trim().min(1).max(120).nullish(),
	active: z.boolean().default(true),
});

export const serviceListInput = listInput.extend({
	trade: z.string().optional(),
	active: z.boolean().optional(),
});

export type ServiceListInput = z.infer<typeof serviceListInput>;

export const serviceIdInput = z.object({ id: z.string().min(1) });

export type ServiceIdInput = z.infer<typeof serviceIdInput>;

export const serviceCreateInput = serviceFields;

export type ServiceCreateInput = z.infer<typeof serviceCreateInput>;

export const serviceUpdateInput = z.object({
	id: z.string().min(1),
	data: serviceFields.partial(),
});

export type ServiceUpdateInput = z.infer<typeof serviceUpdateInput>;
