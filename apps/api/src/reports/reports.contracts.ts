import { z } from "zod";
import { toDay } from "../projects/projects.contracts";
import { AGING_BUCKETS } from "./reports-logic";

const dayInput = z.coerce.date().transform(toDay);

export const reportRangeInput = z.object({
	from: dayInput.optional(),
	to: dayInput.optional(),
});
export type ReportRangeInput = z.infer<typeof reportRangeInput>;

export const reportKpi = z.object({
	key: z.string(),
	label: z.string(),
	value: z.string(),
	tone: z.enum(["default", "warning", "destructive"]).optional(),
});
export type ReportKpi = z.infer<typeof reportKpi>;

export const reportSeriesPoint = z
	.object({ x: z.string() })
	.catchall(z.union([z.string(), z.number()]));
export type ReportSeriesPoint = z.infer<typeof reportSeriesPoint>;

export const jobProfitabilityRow = z.object({
	dealId: z.string(),
	dealName: z.string(),
	dealNumber: z.number(),
	primaryContactId: z.string().nullable(),
	primaryContactName: z.string().nullable(),
	invoicedCents: z.number(),
	collectedCents: z.number(),
	costsCents: z.number(),
	profitCents: z.number(),
	collectedProfitCents: z.number(),
	marginPct: z.number().nullable(),
});
export type JobProfitabilityRow = z.infer<typeof jobProfitabilityRow>;

export const jobProfitabilityOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	rows: z.array(jobProfitabilityRow),
	excluded: z.number(),
});

export const profitOverTimeRow = z.object({
	month: z.string(),
	invoicedCents: z.number(),
	collectedCents: z.number(),
	costsCents: z.number(),
});
export type ProfitOverTimeRow = z.infer<typeof profitOverTimeRow>;

export const profitOverTimeOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	rows: z.array(profitOverTimeRow),
	excluded: z.number(),
});

export const costCategoryRow = z.object({
	category: z.string(),
	totalCents: z.number(),
});
export type CostCategoryRow = z.infer<typeof costCategoryRow>;

export const costByDealRow = z.object({
	dealId: z.string(),
	dealName: z.string(),
	totalCents: z.number(),
});
export type CostByDealRow = z.infer<typeof costByDealRow>;

export const costByCreatorRow = z.object({
	creatorId: z.string(),
	creatorName: z.string(),
	totalCents: z.number(),
});
export type CostByCreatorRow = z.infer<typeof costByCreatorRow>;

export const costBreakdownOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	rows: z.array(costCategoryRow),
	byDeal: z.array(costByDealRow),
	byCreator: z.array(costByCreatorRow),
	excluded: z.number(),
});

export const arAgingBucket = z.enum(AGING_BUCKETS);
export type ArAgingBucket = z.infer<typeof arAgingBucket>;

export const arAgingRow = z.object({
	invoiceId: z.string(),
	number: z.number(),
	dealId: z.string().nullable(),
	dealName: z.string().nullable(),
	dueAt: z.iso.datetime(),
	ageDays: z.number(),
	bucket: arAgingBucket,
	totalCents: z.number(),
});
export type ArAgingRow = z.infer<typeof arAgingRow>;

export const arAgingOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	rows: z.array(arAgingRow),
	excluded: z.number(),
});
