import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { entryStageOf } from "@crm/db/stage-semantics";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DealsService } from "../src/deals/deals.service";
import { FieldsService } from "../src/fields/fields.service";

const suffix = process.env.TEST_RUN_ID ?? "deals-stages-spec";
const prefix = `spec_${suffix}`;
const domain = `deals-stages-${suffix}.test`;

const agentTrigger = new AgentTriggerService(db);
const stamp = new ActivityStampService(db);
const conversion = new ConversionService(db);
const fields = new FieldsService(db, {
	fieldBackfill: async () => undefined,
} as never);
const deals = new DealsService(db, agentTrigger, stamp, conversion, fields);

let ownerId: string;
let pipelineAId: string;
let pipelineBId: string;
let entryA: { id: string; key: string };
let midA: { id: string; key: string };
let wonA: { id: string; key: string };
let lostA: { id: string; key: string };
let disqualifiedA: { id: string; key: string };
let entryB: { id: string; key: string };

async function expectRejects(
	promise: Promise<unknown>,
	match?: RegExp,
): Promise<void> {
	let caught: unknown;

	try {
		await promise;
	} catch (error) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(Error);
	if (match) expect((caught as Error).message).toMatch(match);
}

async function eventReasonsFor(dealId: string): Promise<string[]> {
	const tasks = await db.agentTask.findMany({
		where: { dealId, kind: "agent-event" },
		select: { reason: true },
	});
	return tasks.map((task) => task.reason).sort();
}

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
	await db.user.deleteMany({ where: { id: `${prefix}_owner` } });
}

beforeAll(async () => {
	await clean();

	const user = await db.user.create({
		data: {
			id: `${prefix}_owner`,
			name: "Stages Rep",
			email: `rep@${domain}`,
		},
		select: { id: true },
	});
	ownerId = user.id;

	const pipelineA = await db.pipeline.create({
		data: { name: `${prefix}_pipeline_a`, position: 9000 },
	});
	pipelineAId = pipelineA.id;

	[entryA, midA, wonA, lostA, disqualifiedA] = await Promise.all([
		db.stage.create({
			data: {
				pipelineId: pipelineAId,
				key: "entry",
				label: "Entry",
				color: "var(--chart-1)",
				position: 0,
				outcome: "OPEN",
				isEntry: true,
			},
			select: { id: true, key: true },
		}),
		db.stage.create({
			data: {
				pipelineId: pipelineAId,
				key: "mid",
				label: "Mid",
				color: "var(--chart-2)",
				position: 1,
				outcome: "OPEN",
			},
			select: { id: true, key: true },
		}),
		db.stage.create({
			data: {
				pipelineId: pipelineAId,
				key: "won",
				label: "Won",
				color: "var(--swatch-1)",
				position: 2,
				outcome: "WON",
			},
			select: { id: true, key: true },
		}),
		db.stage.create({
			data: {
				pipelineId: pipelineAId,
				key: "lost",
				label: "Lost",
				color: "var(--swatch-2)",
				position: 3,
				outcome: "LOST",
			},
			select: { id: true, key: true },
		}),
		db.stage.create({
			data: {
				pipelineId: pipelineAId,
				key: "disqualified",
				label: "Disqualified",
				color: "var(--swatch-3)",
				position: 4,
				outcome: "DISQUALIFIED",
			},
			select: { id: true, key: true },
		}),
	]);

	const pipelineB = await db.pipeline.create({
		data: { name: `${prefix}_pipeline_b`, position: 9001 },
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
		select: { id: true, key: true },
	});
	await db.stage.create({
		data: {
			pipelineId: pipelineBId,
			key: "won_b",
			label: "Won B",
			color: "var(--swatch-4)",
			position: 1,
			outcome: "WON",
		},
	});
	await db.stage.create({
		data: {
			pipelineId: pipelineBId,
			key: "lost_b",
			label: "Lost B",
			color: "var(--swatch-5)",
			position: 2,
			outcome: "LOST",
		},
	});
});

afterAll(clean);

describe("create", () => {
	it("lands a deal with no stage on the default pipeline's entry stage", async () => {
		const pipeline = await db.pipeline.findFirst({
			where: { archivedAt: null },
			orderBy: { position: "asc" },
			select: {
				id: true,
				stages: {
					where: { archivedAt: null },
					select: { id: true, isEntry: true, archivedAt: true, outcome: true },
				},
			},
		});
		const entry = entryStageOf(pipeline?.stages ?? []);
		expect(entry).toBeDefined();

		const deal = await deals.create({
			name: `${prefix}_default_entry`,
			ownerId,
		});

		const stored = await db.deal.findUnique({
			where: { id: deal.id },
			select: { stageId: true },
		});
		expect(stored?.stageId).toBe(entry?.id);
	});

	it("rejects an unknown stage id", async () => {
		await expectRejects(
			deals.create({
				name: `${prefix}_unknown_stage`,
				ownerId,
				stage: "does-not-exist",
			}),
			/no longer exists/,
		);
	});

	it("rejects an archived stage id", async () => {
		const archived = await db.stage.create({
			data: {
				pipelineId: pipelineAId,
				key: "archived_create",
				label: "Archived",
				color: "var(--swatch-6)",
				position: 5,
				outcome: "OPEN",
				archivedAt: new Date(),
			},
			select: { id: true },
		});

		await expectRejects(
			deals.create({
				name: `${prefix}_archived_stage`,
				ownerId,
				stage: archived.id,
			}),
			/no longer exists/,
		);
	});
});

describe("create reason guard", () => {
	it("refuses to create a deal directly into a LOST stage without a reason", async () => {
		await expectRejects(
			deals.create({
				name: `${prefix}_create_lost_no_reason`,
				ownerId,
				stage: lostA.id,
			}),
			/teaches nobody anything/,
		);
	});

	it("refuses to create a deal directly into a DISQUALIFIED stage without a reason", async () => {
		await expectRejects(
			deals.create({
				name: `${prefix}_create_disqualified_no_reason`,
				ownerId,
				stage: disqualifiedA.id,
			}),
			/teaches nobody anything/,
		);
	});

	it("creates a deal into a LOST stage when a reason is given", async () => {
		const deal = await deals.create({
			name: `${prefix}_create_lost_with_reason`,
			ownerId,
			stage: lostA.id,
			closedReason: "Went with a competitor",
		});

		const stored = await db.deal.findUnique({
			where: { id: deal.id },
			select: { closedReason: true, closedAt: true },
		});
		expect(stored?.closedReason).toBe("Went with a competitor");
		expect(stored?.closedAt).not.toBeNull();
	});
});

describe("archived pipeline guard", () => {
	it("rejects setting a deal to a stage on an archived pipeline", async () => {
		const archivedPipeline = await db.pipeline.create({
			data: {
				name: `${prefix}_archived_pipeline`,
				position: 9002,
				archivedAt: new Date(),
			},
		});
		const archivedPipelineStage = await db.stage.create({
			data: {
				pipelineId: archivedPipeline.id,
				key: "archived_pipeline_entry",
				label: "Entry",
				color: "var(--chart-1)",
				position: 0,
				outcome: "OPEN",
				isEntry: true,
			},
			select: { id: true },
		});

		const deal = await deals.create({
			name: `${prefix}_archived_pipeline_target`,
			ownerId,
			stage: entryA.id,
		});

		await expectRejects(
			deals.setStage({ id: deal.id, stage: archivedPipelineStage.id }, ownerId),
			/no longer exists/,
		);
	});
});

describe("setStage reason guard", () => {
	it("refuses to close as LOST without a reason", async () => {
		const deal = await deals.create({
			name: `${prefix}_lost_no_reason`,
			ownerId,
			stage: entryA.id,
		});

		await expectRejects(
			deals.setStage({ id: deal.id, stage: lostA.id }, ownerId),
			/teaches nobody anything/,
		);
	});

	it("refuses to close as DISQUALIFIED without a reason", async () => {
		const deal = await deals.create({
			name: `${prefix}_disqualified_no_reason`,
			ownerId,
			stage: entryA.id,
		});

		await expectRejects(
			deals.setStage({ id: deal.id, stage: disqualifiedA.id }, ownerId),
			/teaches nobody anything/,
		);
	});

	it("allows LOST with a reason and clears back open again", async () => {
		const deal = await deals.create({
			name: `${prefix}_lost_then_reopened`,
			ownerId,
			stage: entryA.id,
		});

		const closed = await deals.setStage(
			{ id: deal.id, stage: lostA.id, closedReason: "Went cold" },
			ownerId,
		);
		expect(closed.changed).toBe(true);

		const closedRow = await db.deal.findUnique({
			where: { id: deal.id },
			select: { closedAt: true, closedReason: true },
		});
		expect(closedRow?.closedAt).not.toBeNull();
		expect(closedRow?.closedReason).toBe("Went cold");

		const reopened = await deals.setStage(
			{ id: deal.id, stage: midA.id },
			ownerId,
		);
		expect(reopened.changed).toBe(true);

		const reopenedRow = await db.deal.findUnique({
			where: { id: deal.id },
			select: { closedAt: true, closedReason: true },
		});
		expect(reopenedRow?.closedAt).toBeNull();
		expect(reopenedRow?.closedReason).toBeNull();

		const reasons = await eventReasonsFor(deal.id);
		expect(reasons).toEqual([
			"deal.closed",
			"deal.created",
			"deal.opened",
			"deal.stage.changed",
			"deal.stage.changed",
		]);
	});
});

describe("bulkSetStage reason guard", () => {
	it("refuses DISQUALIFIED without a reason for the whole selection", async () => {
		const deal = await deals.create({
			name: `${prefix}_bulk_disqualified`,
			ownerId,
			stage: entryA.id,
		});

		await expectRejects(
			deals.bulkSetStage({ ids: [deal.id], stage: disqualifiedA.id }, ownerId),
			/teaches nobody anything/,
		);
	});
});

describe("wonOnly and pipelineId filters", () => {
	it("wonOnly returns only deals in a WON stage", async () => {
		const won = await deals.create({
			name: `${prefix}_filter_won`,
			ownerId,
			stage: wonA.id,
		});
		const open = await deals.create({
			name: `${prefix}_filter_open`,
			ownerId,
			stage: entryA.id,
		});

		const list = await deals.list({
			q: prefix,
			page: 1,
			pageSize: 25,
			sort: "",
			dir: "asc",
			status: "all",
			owner: "all",
			stage: "all",
			closing: "all",
			wonOnly: true,
		});

		const ids = list.rows.map((row) => (row as { id: string }).id);
		expect(ids).toContain(won.id);
		expect(ids).not.toContain(open.id);
	});

	it("pipelineId returns only deals on that pipeline", async () => {
		const inA = await deals.create({
			name: `${prefix}_filter_pipeline_a`,
			ownerId,
			stage: entryA.id,
		});
		const inB = await deals.create({
			name: `${prefix}_filter_pipeline_b`,
			ownerId,
			stage: entryB.id,
		});

		const list = await deals.list({
			q: prefix,
			page: 1,
			pageSize: 25,
			sort: "",
			dir: "asc",
			status: "all",
			owner: "all",
			stage: "all",
			closing: "all",
			pipelineId: pipelineAId,
		});

		const ids = list.rows.map((row) => (row as { id: string }).id);
		expect(ids).toContain(inA.id);
		expect(ids).not.toContain(inB.id);
	});
});

describe("closing filter merges with pipeline filter", () => {
	it("keeps the pipelineId filter when closing is overdue", async () => {
		const overdue = new Date(
			Date.now() - 7 * 24 * 60 * 60 * 1000,
		).toISOString();

		const overdueInA = await deals.create({
			name: `${prefix}_overdue_pipeline_a`,
			ownerId,
			stage: entryA.id,
			expectedCloseDate: overdue,
		});
		const overdueInB = await deals.create({
			name: `${prefix}_overdue_pipeline_b`,
			ownerId,
			stage: entryB.id,
			expectedCloseDate: overdue,
		});

		const list = await deals.list({
			q: prefix,
			page: 1,
			pageSize: 25,
			sort: "",
			dir: "asc",
			status: "all",
			owner: "all",
			stage: "all",
			closing: "overdue",
			pipelineId: pipelineAId,
		});

		const ids = list.rows.map((row) => (row as { id: string }).id);
		expect(ids).toContain(overdueInA.id);
		expect(ids).not.toContain(overdueInB.id);
	});
});

describe("searchFilter digit overflow", () => {
	it("returns name matches without throwing on a 10-digit phone-number query", async () => {
		const named = await deals.create({
			name: `${prefix}_5551234567_callback`,
			ownerId,
			stage: entryA.id,
		});

		const list = await deals.list({
			q: "5551234567",
			page: 1,
			pageSize: 25,
			sort: "",
			dir: "asc",
			status: "all",
			owner: "all",
			stage: "all",
			closing: "all",
		});

		const ids = list.rows.map((row) => (row as { id: string }).id);
		expect(ids).toContain(named.id);
	});
});

describe("facetCounts stage meta", () => {
	it("carries id/label/color/pipelineId for every counted stage", async () => {
		await deals.create({
			name: `${prefix}_facet_meta`,
			ownerId,
			stage: midA.id,
		});

		const list = await deals.list({
			q: prefix,
			page: 1,
			pageSize: 25,
			sort: "",
			dir: "asc",
			status: "all",
			owner: "all",
			stage: "all",
			closing: "all",
		});

		const meta = list.stages.find((stage) => stage.id === midA.id);
		expect(meta).toEqual({
			id: midA.id,
			label: "Mid",
			color: "var(--chart-2)",
			pipelineId: pipelineAId,
		});
	});
});

describe("cross-pipeline setStage", () => {
	it("moves the deal's pipeline when the target stage lives elsewhere", async () => {
		const deal = await deals.create({
			name: `${prefix}_cross_pipeline`,
			ownerId,
			stage: entryA.id,
		});

		const moved = await deals.setStage(
			{ id: deal.id, stage: entryB.id },
			ownerId,
		);
		expect(moved.changed).toBe(true);

		const row = await db.deal.findUnique({
			where: { id: deal.id },
			select: { stage: { select: { pipelineId: true } } },
		});
		expect(row?.stage.pipelineId).toBe(pipelineBId);
	});
});

describe("closing filter guard", () => {
	it("rejects a closing value that is not a closing window, instead of a 500", async () => {
		await expectRejects(
			deals.list({
				q: prefix,
				page: 1,
				pageSize: 25,
				sort: "",
				dir: "asc",
				status: "all",
				owner: "all",
				stage: "all",
				closing: "cksomeactualdealidnotawindow",
			}),
			/is not a closing window/,
		);
	});
});

describe("sort by stage position", () => {
	it("orders by the stage's position within its pipeline", async () => {
		const last = await deals.create({
			name: `${prefix}_sort_last`,
			ownerId,
			stage: lostA.id,
			closedReason: "Went with a competitor",
		});
		const first = await deals.create({
			name: `${prefix}_sort_first`,
			ownerId,
			stage: entryA.id,
		});

		const list = await deals.list({
			q: prefix,
			page: 1,
			pageSize: 50,
			sort: "stage",
			dir: "asc",
			status: "all",
			owner: "all",
			stage: "all",
			closing: "all",
			pipelineId: pipelineAId,
		});

		const ids = list.rows.map((row) => (row as { id: string }).id);
		expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(last.id));
	});
});
