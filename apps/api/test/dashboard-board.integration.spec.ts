import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { DealsService } from "../src/deals/deals.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "dashboard-board-spec";
const prefix = `spec_${suffix}`;
const domain = `dashboard-board-${suffix}.test`;
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

let pipelineId: string;
let stageA: { id: string; label: string; color: string };
let stageB: { id: string; label: string; color: string };
let wonStage: { id: string };
let dealA1Id: string;
let dealA2Id: string;
let dealA3Id: string;
let dealA4Id: string;

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

	await db.user.create({
		data: { id: ownerId, name: "Board Rep", email: `rep@${domain}` },
	});

	const pipeline = await db.pipeline.create({
		data: { name: `${prefix}_pipeline`, position: -999997 },
	});
	pipelineId = pipeline.id;

	stageA = await db.stage.create({
		data: {
			pipelineId,
			key: "entry",
			label: "Entry",
			color: "var(--chart-1)",
			position: 0,
			outcome: "OPEN",
			isEntry: true,
		},
		select: { id: true, label: true, color: true },
	});
	stageB = await db.stage.create({
		data: {
			pipelineId,
			key: "mid",
			label: "Mid",
			color: "var(--chart-2)",
			position: 1,
			outcome: "OPEN",
		},
		select: { id: true, label: true, color: true },
	});
	wonStage = await db.stage.create({
		data: {
			pipelineId,
			key: "won",
			label: "Won",
			color: "var(--swatch-1)",
			position: 2,
			outcome: "WON",
		},
		select: { id: true },
	});

	const dealA1 = await deals.create({
		name: `${prefix}_a1`,
		ownerId,
		amountCents: 100_00,
		currency: "USD",
		stage: stageA.id,
	});
	dealA1Id = dealA1.id;

	const dealA2 = await deals.create({
		name: `${prefix}_a2`,
		ownerId,
		amountCents: 300_00,
		currency: "USD",
		stage: stageA.id,
	});
	dealA2Id = dealA2.id;

	const dealA3 = await deals.create({
		name: `${prefix}_a3`,
		ownerId,
		amountCents: 200_00,
		currency: "USD",
		stage: stageA.id,
	});
	dealA3Id = dealA3.id;

	const dealA4 = await deals.create({
		name: `${prefix}_a4`,
		ownerId,
		stage: stageA.id,
	});
	dealA4Id = dealA4.id;

	const wonDeal = await deals.create({
		name: `${prefix}_won`,
		ownerId,
		amountCents: 999_00,
		currency: "USD",
		stage: stageA.id,
	});
	await deals.setStage({ id: wonDeal.id, stage: wonStage.id }, ownerId);
});

afterAll(async () => {
	await clean();
});

describe("pipelineBoard", () => {
	it("returns open stages in board order with counts and top deals", async () => {
		const board = await dashboard.pipelineBoard({ pipelineId });

		expect(board.stages).toEqual([
			{
				id: stageA.id,
				label: stageA.label,
				color: stageA.color,
				count: 4,
				topDeals: [
					{
						id: dealA2Id,
						name: `${prefix}_a2`,
						amountCents: 300_00,
						currency: "USD",
					},
					{
						id: dealA3Id,
						name: `${prefix}_a3`,
						amountCents: 200_00,
						currency: "USD",
					},
					{
						id: dealA1Id,
						name: `${prefix}_a1`,
						amountCents: 100_00,
						currency: "USD",
					},
				],
			},
			{
				id: stageB.id,
				label: stageB.label,
				color: stageB.color,
				count: 0,
				topDeals: [],
			},
		]);

		const ids = board.stages.map((stage) => stage.id);
		expect(ids).not.toContain(wonStage.id);
		expect(dealA4Id).toBeTruthy();
	});
});
