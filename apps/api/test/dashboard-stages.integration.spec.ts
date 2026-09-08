import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { SETTINGS_ID, writeReportingCurrency } from "@crm/db/settings";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { DealsService } from "../src/deals/deals.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "dashboard-stages-spec";
const prefix = `spec_${suffix}`;
const domain = `dashboard-stages-${suffix}.test`;
const ownerId = `${prefix}_owner`;

const agent = {
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;
const conversion = new ConversionService(db);
const deals = new DealsService(
	db,
	agent,
	new ActivityStampService(db),
	conversion,
	new FieldsService(db, { fieldBackfill: async () => undefined } as never),
);
const dashboard = new DashboardService(db, conversion);

let previousReportingCurrency: string | null = null;
let pipelineAId: string;
let pipelineBId: string;
let entryA: { id: string; label: string; color: string };
let midA: { id: string; label: string; color: string };
let wonA: { id: string };
let lostA: { id: string };
let disqualifiedA: { id: string };
let entryB: { id: string };
let wonB: { id: string };
let lostB: { id: string };
let openEntryADealId: string;
let openMidADealId: string;
let openEntryBDealId: string;

async function clean() {
	const existing = await db.deal.findMany({
		where: { name: { startsWith: prefix } },
		select: { id: true },
	});
	const dealIds = existing.map((deal) => deal.id);

	if (dealIds.length > 0) {
		await db.agentTask.deleteMany({ where: { dealId: { in: dealIds } } });
	}
	await db.deal.deleteMany({ where: { name: { startsWith: prefix } } });
	await db.stage.deleteMany({
		where: { pipeline: { name: { startsWith: prefix } } },
	});
	await db.pipeline.deleteMany({ where: { name: { startsWith: prefix } } });
	await db.user.deleteMany({ where: { id: ownerId } });
}

beforeAll(async () => {
	await clean();

	const existing = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { reportingCurrency: true },
	});
	previousReportingCurrency = existing?.reportingCurrency ?? null;
	await writeReportingCurrency(db, "USD");

	await db.user.create({
		data: { id: ownerId, name: "Dashboard Rep", email: `rep@${domain}` },
	});

	const pipelineA = await db.pipeline.create({
		data: { name: `${prefix}_pipeline_a`, position: -999999 },
	});
	pipelineAId = pipelineA.id;

	entryA = await db.stage.create({
		data: {
			pipelineId: pipelineAId,
			key: "entry",
			label: "Entry A",
			color: "var(--chart-1)",
			position: 0,
			outcome: "OPEN",
			isEntry: true,
		},
		select: { id: true, label: true, color: true },
	});
	midA = await db.stage.create({
		data: {
			pipelineId: pipelineAId,
			key: "mid",
			label: "Mid A",
			color: "var(--chart-2)",
			position: 1,
			outcome: "OPEN",
		},
		select: { id: true, label: true, color: true },
	});
	wonA = await db.stage.create({
		data: {
			pipelineId: pipelineAId,
			key: "won",
			label: "Won A",
			color: "var(--swatch-1)",
			position: 2,
			outcome: "WON",
		},
		select: { id: true },
	});
	lostA = await db.stage.create({
		data: {
			pipelineId: pipelineAId,
			key: "lost",
			label: "Lost A",
			color: "var(--swatch-2)",
			position: 3,
			outcome: "LOST",
		},
		select: { id: true },
	});
	disqualifiedA = await db.stage.create({
		data: {
			pipelineId: pipelineAId,
			key: "disqualified",
			label: "Disqualified A",
			color: "var(--swatch-3)",
			position: 4,
			outcome: "DISQUALIFIED",
		},
		select: { id: true },
	});

	const pipelineB = await db.pipeline.create({
		data: { name: `${prefix}_pipeline_b`, position: -999998 },
	});
	pipelineBId = pipelineB.id;

	entryB = await db.stage.create({
		data: {
			pipelineId: pipelineBId,
			key: "entry_b",
			label: "Entry B",
			color: "var(--chart-3)",
			position: 0,
			outcome: "OPEN",
			isEntry: true,
		},
		select: { id: true },
	});
	wonB = await db.stage.create({
		data: {
			pipelineId: pipelineBId,
			key: "won_b",
			label: "Won B",
			color: "var(--swatch-4)",
			position: 1,
			outcome: "WON",
		},
		select: { id: true },
	});
	lostB = await db.stage.create({
		data: {
			pipelineId: pipelineBId,
			key: "lost_b",
			label: "Lost B",
			color: "var(--swatch-5)",
			position: 2,
			outcome: "LOST",
		},
		select: { id: true },
	});

	const thisMonth = new Date();
	thisMonth.setDate(15);

	const openEntryADeal = await deals.create({
		name: `${prefix}_open_entry_a`,
		ownerId,
		amountCents: 100_00,
		currency: "USD",
		stage: entryA.id,
		expectedCloseDate: thisMonth.toISOString(),
	});
	openEntryADealId = openEntryADeal.id;

	const openMidADeal = await deals.create({
		name: `${prefix}_open_mid_a`,
		ownerId,
		amountCents: 200_00,
		currency: "USD",
		stage: midA.id,
		expectedCloseDate: thisMonth.toISOString(),
	});
	openMidADealId = openMidADeal.id;

	const openEntryBDeal = await deals.create({
		name: `${prefix}_open_entry_b`,
		ownerId,
		amountCents: 900_00,
		currency: "USD",
		stage: entryB.id,
		expectedCloseDate: thisMonth.toISOString(),
	});
	openEntryBDealId = openEntryBDeal.id;

	const wonADeal = await deals.create({
		name: `${prefix}_won_a`,
		ownerId,
		amountCents: 300_00,
		currency: "USD",
		stage: entryA.id,
	});
	await deals.setStage({ id: wonADeal.id, stage: wonA.id }, ownerId);

	const wonBDeal = await deals.create({
		name: `${prefix}_won_b`,
		ownerId,
		amountCents: 400_00,
		currency: "USD",
		stage: entryB.id,
	});
	await deals.setStage({ id: wonBDeal.id, stage: wonB.id }, ownerId);

	const lostADeal = await deals.create({
		name: `${prefix}_lost_a`,
		ownerId,
		amountCents: 50_00,
		currency: "USD",
		stage: entryA.id,
	});
	await deals.setStage(
		{ id: lostADeal.id, stage: lostA.id, closedReason: "Went cold" },
		ownerId,
	);

	const lostBDeal = await deals.create({
		name: `${prefix}_lost_b`,
		ownerId,
		amountCents: 60_00,
		currency: "USD",
		stage: entryB.id,
	});
	await deals.setStage(
		{ id: lostBDeal.id, stage: lostB.id, closedReason: "Went cold" },
		ownerId,
	);

	const disqualifiedDeal = await deals.create({
		name: `${prefix}_disqualified_a`,
		ownerId,
		amountCents: 70_00,
		currency: "USD",
		stage: entryA.id,
	});
	await deals.setStage(
		{
			id: disqualifiedDeal.id,
			stage: disqualifiedA.id,
			closedReason: "Not a fit",
		},
		ownerId,
	);
});

afterAll(async () => {
	await clean();

	if (previousReportingCurrency) {
		await writeReportingCurrency(db, previousReportingCurrency);
	} else {
		await db.appSetting.updateMany({ data: { reportingCurrency: null } });
	}
});

describe("pipeline-by-stage chart", () => {
	it("returns only the requested pipeline's OPEN stages, with meta", async () => {
		const summary = await dashboard.summary(ownerId, {
			scope: "me",
			pipelineId: pipelineAId,
		});

		expect(summary.pipeline.pipelineId).toBe(pipelineAId);
		expect(summary.pipeline.stages).toEqual([
			{
				id: entryA.id,
				label: entryA.label,
				color: entryA.color,
				count: 1,
				valueCents: 100_00,
			},
			{
				id: midA.id,
				label: midA.label,
				color: midA.color,
				count: 1,
				valueCents: 200_00,
			},
		]);
		expect(summary.pipeline.totalCents).toBe(300_00);
		expect(summary.pipeline.totalDeals).toBe(2);
	});

	it("defaults to the lowest-position non-archived pipeline", async () => {
		const summary = await dashboard.summary(ownerId, { scope: "me" });

		expect(summary.pipeline.pipelineId).toBe(pipelineAId);
	});

	it("excludes another pipeline's open stages when scoped", async () => {
		const summary = await dashboard.summary(ownerId, {
			scope: "me",
			pipelineId: pipelineBId,
		});

		expect(summary.pipeline.pipelineId).toBe(pipelineBId);
		const ids = summary.pipeline.stages.map((stage) => stage.id);
		expect(ids).toEqual([entryB.id]);
		expect(ids).not.toContain(entryA.id);
		expect(ids).not.toContain(midA.id);
	});

	it("pipelineStages matches summary's chart for the same pipeline", async () => {
		const summary = await dashboard.summary(ownerId, {
			scope: "me",
			pipelineId: pipelineAId,
		});
		const stages = await dashboard.pipelineStages(ownerId, {
			scope: "me",
			pipelineId: pipelineAId,
		});

		expect(stages).toEqual(summary.pipeline);
	});
});

describe("money aggregates across all pipelines", () => {
	it("sums closing-this-month and biggest-open across both pipelines", async () => {
		const summary = await dashboard.summary(ownerId, {
			scope: "me",
			pipelineId: pipelineAId,
		});

		expect(summary.closingThisMonthTotal.count).toBe(3);
		expect(summary.closingThisMonthTotal.valueCents).toBe(
			100_00 + 200_00 + 900_00,
		);

		const openIds = summary.biggestOpen.map((deal) => deal.id);
		expect(openIds).toContain(openEntryADealId);
		expect(openIds).toContain(openMidADealId);
		expect(openIds).toContain(openEntryBDealId);
	});
});

describe("win/lost trend and win rate — outcome parity", () => {
	it("counts WON as wins, LOST as losses, and excludes DISQUALIFIED entirely", async () => {
		const summary = await dashboard.summary(ownerId, { scope: "me" });

		expect(summary.performance.wins).toBe(2);
		expect(summary.performance.losses).toBe(2);
		expect(summary.performance.winRate).toBe(0.5);
	});
});
