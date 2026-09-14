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

export const stageChangeMeta = z
	.object({ from: z.string(), to: z.string() })
	.strict();
export type StageChangeMeta = z.infer<typeof stageChangeMeta>;

export function parseStageChangeMeta(value: unknown): StageChangeMeta | null {
	const result = stageChangeMeta.safeParse(value);
	return result.success ? result.data : null;
}

export const productionStageChangeMeta = z.object({
	kind: z.literal("production"),
	to: z.string(),
	from: z.string().nullable().optional(),
});
export type ProductionStageChangeMeta = z.infer<
	typeof productionStageChangeMeta
>;

export function parseProductionStageChangeMeta(
	value: unknown,
): ProductionStageChangeMeta | null {
	const result = productionStageChangeMeta.safeParse(value);
	return result.success ? result.data : null;
}

export const leaderboardRow = z.object({
	userId: z.string(),
	name: z.string(),
	wonCents: z.number().nullable(),
	wonCount: z.number(),
	openCount: z.number(),
	winRatePct: z.number().nullable(),
	activitiesLogged: z.number(),
});
export type LeaderboardRow = z.infer<typeof leaderboardRow>;

export const leaderboardOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	rows: z.array(leaderboardRow),
	excluded: z.number(),
});

export const pipelineStageFunnelRow = z.object({
	stageId: z.string(),
	stageKey: z.string(),
	stageLabel: z.string(),
	outcome: z.string(),
	count: z.number(),
	conversionPct: z.number().nullable(),
	avgDaysInStage: z.number().nullable(),
});
export type PipelineStageFunnelRow = z.infer<typeof pipelineStageFunnelRow>;

export const pipelineLossReasonRow = z.object({
	reason: z.string(),
	count: z.number(),
});
export type PipelineLossReasonRow = z.infer<typeof pipelineLossReasonRow>;

export const pipelineFunnel = z.object({
	pipelineId: z.string(),
	pipelineName: z.string(),
	stages: z.array(pipelineStageFunnelRow),
	lossReasons: z.array(pipelineLossReasonRow),
});
export type PipelineFunnel = z.infer<typeof pipelineFunnel>;

export const estimatesFunnelTierRow = z.object({
	tier: z.string(),
	count: z.number(),
	valueCents: z.number().nullable(),
});
export type EstimatesFunnelTierRow = z.infer<typeof estimatesFunnelTierRow>;

export const estimatesFunnel = z.object({
	sentCount: z.number(),
	acceptedCount: z.number(),
	declinedCount: z.number(),
	acceptRatePct: z.number().nullable(),
	byTier: z.array(estimatesFunnelTierRow),
	avgDaysToAccept: z.number().nullable(),
});
export type EstimatesFunnel = z.infer<typeof estimatesFunnel>;

export const pipelineOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	pipelines: z.array(pipelineFunnel),
	estimatesFunnel,
	excluded: z.number(),
});

export const leadSourceRow = z.object({
	source: z.string(),
	contacts: z.number(),
	deals: z.number(),
	wonCount: z.number(),
	wonCents: z.number().nullable(),
});
export type LeadSourceRow = z.infer<typeof leadSourceRow>;

export const leadSourcesOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	rows: z.array(leadSourceRow),
	excluded: z.number(),
});

export const productionStageCountRow = z.object({
	stage: z.string(),
	count: z.number(),
});
export type ProductionStageCountRow = z.infer<typeof productionStageCountRow>;

export const productionThroughputRow = z.object({
	month: z.string(),
	count: z.number(),
});
export type ProductionThroughputRow = z.infer<typeof productionThroughputRow>;

export const productionCrewRow = z.object({
	crewId: z.string(),
	name: z.string(),
	color: z.string(),
	taskCount: z.number(),
	taskDays: z.number(),
	doneCount: z.number(),
	openCount: z.number(),
});
export type ProductionCrewRow = z.infer<typeof productionCrewRow>;

export const productionOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	stageCounts: z.array(productionStageCountRow),
	throughputByMonth: z.array(productionThroughputRow),
	avgScheduledToCompleteDays: z.number().nullable(),
	crews: z.array(productionCrewRow),
});

export const permitStatusCountRow = z.object({
	status: z.string(),
	count: z.number(),
});
export type PermitStatusCountRow = z.infer<typeof permitStatusCountRow>;

export const permitJurisdictionCycleRow = z.object({
	jurisdictionId: z.string(),
	jurisdictionName: z.string(),
	avgDays: z.number(),
});
export type PermitJurisdictionCycleRow = z.infer<
	typeof permitJurisdictionCycleRow
>;

export const permitExpiringRow = z.object({
	permitId: z.string(),
	dealId: z.string(),
	dealName: z.string(),
	permitType: z.string(),
	expiresAt: z.iso.datetime(),
});
export type PermitExpiringRow = z.infer<typeof permitExpiringRow>;

export const permitsOutput = z.object({
	kpis: z.array(reportKpi),
	series: z.array(reportSeriesPoint),
	statusCounts: z.array(permitStatusCountRow),
	cycleDaysByJurisdiction: z.array(permitJurisdictionCycleRow),
	inspectionPassRatePct: z.number().nullable(),
	feesCents: z.number().nullable(),
	expiring: z.array(permitExpiringRow),
});
