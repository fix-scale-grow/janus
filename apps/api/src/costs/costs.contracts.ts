import { JobCostCategory } from "@crm/db";
import { z } from "zod";
import { toDay } from "../projects/projects.contracts";
import { COSTS } from "./costs.config";

const dayInput = z.coerce.date().transform(toDay);

export const costCategoryEnum = z.enum(
	Object.values(JobCostCategory) as [JobCostCategory, ...JobCostCategory[]],
);

export const costListInput = z.object({ dealId: z.string().min(1) });

const AMOUNT_TOO_LARGE = "That amount is too large to record.";

const amountCents = z
	.number()
	.int(AMOUNT_TOO_LARGE)
	.min(1)
	.max(COSTS.maxAmountCents, AMOUNT_TOO_LARGE);

export const costCreateInput = z.object({
	dealId: z.string().min(1),
	date: dayInput,
	amountCents,
	category: costCategoryEnum,
	note: z.string().trim().max(COSTS.noteMax).optional(),
});
export type CostCreateInput = z.infer<typeof costCreateInput>;

export const costUpdateInput = z.object({
	id: z.string().min(1),
	date: dayInput.optional(),
	amountCents: amountCents.optional(),
	category: costCategoryEnum.optional(),
	note: z.string().trim().max(COSTS.noteMax).nullable().optional(),
});
export type CostUpdateInput = z.infer<typeof costUpdateInput>;

export const costIdInput = z.object({ id: z.string().min(1) });

export const profitForDealInput = z.object({ dealId: z.string().min(1) });
