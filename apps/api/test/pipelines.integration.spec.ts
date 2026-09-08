import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, StageOutcome } from "@crm/db";
import { PipelinesService } from "../src/pipelines/pipelines.service";

const suffix = process.env.TEST_RUN_ID ?? "pipelines-spec";
const prefix = `spec_${suffix}`;

const pipelines = new PipelinesService(db);

async function clean() {
	await db.deal.deleteMany({ where: { name: { startsWith: prefix } } });
	await db.stage.deleteMany({
		where: { pipeline: { name: { startsWith: prefix } } },
	});
	await db.pipeline.deleteMany({ where: { name: { startsWith: prefix } } });
	await db.user.deleteMany({ where: { id: `${prefix}_owner` } });
}

let ownerId: string;

beforeAll(async () => {
	await clean();

	const user = await db.user.create({
		data: {
			id: `${prefix}_owner`,
			name: "Pipelines Rep",
			email: `rep@${prefix}.test`,
		},
		select: { id: true },
	});
	ownerId = user.id;
});

afterAll(async () => {
	await clean();
});

async function makePipeline(name: string) {
	return pipelines.createPipeline(`${prefix}_${name}`);
}

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

describe("createPipeline", () => {
	it("seeds an entry, a won, and a lost stage", async () => {
		const pipeline = await makePipeline("basic");

		expect(pipeline.stages).toHaveLength(3);

		const entry = pipeline.stages.find((stage) => stage.isEntry);
		const won = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.WON,
		);
		const lost = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.LOST,
		);

		expect(entry?.label).toBe("New lead");
		expect(entry?.outcome).toBe(StageOutcome.OPEN);
		expect(won?.label).toBe("Won");
		expect(lost?.label).toBe("Lost");
	});

	it("appends new pipelines after the highest position", async () => {
		const before = await pipelines.list(false);
		const maxPosition = before.reduce(
			(max, pipeline) => Math.max(max, pipeline.position),
			-1,
		);

		const created = await makePipeline("appended");

		expect(created.position).toBe(maxPosition + 1);
	});
});

describe("list", () => {
	it("orders pipelines and nested stages by position", async () => {
		const pipeline = await makePipeline("ordering");

		const [list] = await Promise.all([pipelines.list(false)]);
		const found = list.find((entry) => entry.id === pipeline.id);

		expect(found).toBeDefined();
		const positions = found?.stages.map((stage) => stage.position) ?? [];
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
	});

	it("excludes archived pipelines unless includeArchived is set", async () => {
		const pipeline = await makePipeline("archivable");
		await pipelines.archivePipeline(pipeline.id);

		const withoutArchived = await pipelines.list(false);
		const withArchived = await pipelines.list(true);

		expect(withoutArchived.some((entry) => entry.id === pipeline.id)).toBe(
			false,
		);
		expect(withArchived.some((entry) => entry.id === pipeline.id)).toBe(true);
	});
});

describe("createStage", () => {
	it("slugs the key from the label and uniquifies on collision", async () => {
		const pipeline = await makePipeline("slugs");

		const first = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Inspection scheduled",
			color: "var(--chart-2)",
			outcome: StageOutcome.OPEN,
		});

		const second = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Inspection scheduled",
			color: "var(--chart-3)",
			outcome: StageOutcome.OPEN,
		});

		expect(first.key).toBe("inspection_scheduled");
		expect(second.key).not.toBe(first.key);
		expect(second.key.startsWith("inspection_scheduled")).toBe(true);
	});

	it("appends the new stage after the current last position", async () => {
		const pipeline = await makePipeline("stage-position");

		const stage = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Estimate sent",
			color: "var(--chart-4)",
			outcome: StageOutcome.OPEN,
		});

		expect(stage.position).toBe(3);
	});
});

describe("entry invariant", () => {
	it("moves the entry flag off the previous holder", async () => {
		const pipeline = await makePipeline("entry-move");
		const other = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Qualified",
			color: "var(--chart-2)",
			outcome: StageOutcome.OPEN,
		});

		const updated = await pipelines.updateStage(other.id, { isEntry: true });
		expect(updated.isEntry).toBe(true);

		const oldEntry = pipeline.stages.find((stage) => stage.isEntry);
		const refreshed = await db.stage.findUnique({
			where: { id: oldEntry?.id },
		});
		expect(refreshed?.isEntry).toBe(false);
	});

	it("refuses to make a non-open stage the entry", async () => {
		const pipeline = await makePipeline("entry-open-only");
		const won = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.WON,
		);

		await expectRejects(
			pipelines.updateStage(won?.id ?? "", { isEntry: true }),
			/open/i,
		);
	});

	it("refuses to change the entry stage's outcome away from open", async () => {
		const pipeline = await makePipeline("entry-outcome-guard");
		const entry = pipeline.stages.find((stage) => stage.isEntry);

		await expectRejects(
			pipelines.updateStage(entry?.id ?? "", { outcome: StageOutcome.WON }),
		);
	});

	it("refuses to archive the entry stage", async () => {
		const pipeline = await makePipeline("entry-archive-guard");
		const entry = pipeline.stages.find((stage) => stage.isEntry);

		await expectRejects(pipelines.archiveStage(entry?.id ?? ""));
	});

	it("refuses to unset isEntry without naming a replacement", async () => {
		const pipeline = await makePipeline("entry-unset-guard");
		const entry = pipeline.stages.find((stage) => stage.isEntry);

		await expectRejects(
			pipelines.updateStage(entry?.id ?? "", { isEntry: false }),
		);
	});
});

describe("won/lost invariants", () => {
	it("refuses to archive the last won stage", async () => {
		const pipeline = await makePipeline("last-won");
		const won = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.WON,
		);

		await expectRejects(pipelines.archiveStage(won?.id ?? ""), /won/i);
	});

	it("refuses to retype the last won stage away from won", async () => {
		const pipeline = await makePipeline("last-won-retype");
		const won = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.WON,
		);

		await expectRejects(
			pipelines.updateStage(won?.id ?? "", { outcome: StageOutcome.OPEN }),
			/won/i,
		);
	});

	it("allows archiving a won stage when another won stage remains", async () => {
		const pipeline = await makePipeline("second-won");
		const won = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.WON,
		);

		const secondWon = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Signed",
			color: "var(--swatch-4)",
			outcome: StageOutcome.WON,
		});

		const archived = await pipelines.archiveStage(won?.id ?? "");
		expect(archived.archivedAt).not.toBeNull();

		const stillThere = await db.stage.findUnique({
			where: { id: secondWon.id },
		});
		expect(stillThere?.archivedAt).toBeNull();
	});

	it("refuses to archive the last lost stage", async () => {
		const pipeline = await makePipeline("last-lost");
		const lost = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.LOST,
		);

		await expectRejects(pipelines.archiveStage(lost?.id ?? ""), /lost/i);
	});
});

describe("outcome retype and deals", () => {
	it("refuses to retype a stage's outcome while a deal still references it", async () => {
		const pipeline = await makePipeline("retype-with-deals");

		const extra = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Qualifying",
			color: "var(--swatch-4)",
			outcome: StageOutcome.OPEN,
		});

		const deal = await db.deal.create({
			data: {
				name: `${prefix}_deal_retype_blocked`,
				ownerId,
				stageId: extra.id,
			},
			select: { id: true },
		});

		await expectRejects(
			pipelines.updateStage(extra.id, { outcome: StageOutcome.LOST }),
			/holds deals/i,
		);

		await db.deal.delete({ where: { id: deal.id } });
	});

	it("allows retyping an empty stage's outcome freely", async () => {
		const pipeline = await makePipeline("retype-empty");

		const extra = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Qualifying",
			color: "var(--swatch-4)",
			outcome: StageOutcome.OPEN,
		});

		const updated = await pipelines.updateStage(extra.id, {
			outcome: StageOutcome.LOST,
		});

		expect(updated.outcome).toBe(StageOutcome.LOST);
	});
});

describe("color invariant", () => {
	it("refuses a color outside the curated swatch set", async () => {
		const pipeline = await makePipeline("bad-color");

		await expectRejects(
			pipelines.createStage({
				pipelineId: pipeline.id,
				label: "Rogue",
				color: "#ff00ff",
				outcome: StageOutcome.OPEN,
			}),
		);
	});
});

describe("deleteStage", () => {
	it("deletes a stage that no deal has ever referenced", async () => {
		const pipeline = await makePipeline("delete-empty");
		const stage = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Scratch",
			color: "var(--swatch-5)",
			outcome: StageOutcome.OPEN,
		});

		const result = await pipelines.deleteStage(stage.id);
		expect(result.id).toBe(stage.id);

		expect(await db.stage.findUnique({ where: { id: stage.id } })).toBeNull();
	});

	it("refuses to delete a stage a deal references, and archives instead", async () => {
		const pipeline = await makePipeline("delete-referenced");
		const entry = pipeline.stages.find((stage) => stage.isEntry);

		const deal = await db.deal.create({
			data: {
				name: `${prefix}_deal_referenced`,
				ownerId,
				stageId: entry?.id ?? "",
			},
			select: { id: true },
		});

		await expectRejects(pipelines.deleteStage(entry?.id ?? ""));

		await db.deal.delete({ where: { id: deal.id } });
	});
});

describe("reorderStages and reorderPipelines", () => {
	it("writes explicit positions for stage order within a pipeline", async () => {
		const pipeline = await makePipeline("reorder-stages");
		const ids = pipeline.stages.map((stage) => stage.id).reverse();

		const reordered = await pipelines.reorderStages({
			pipelineId: pipeline.id,
			ids,
		});

		expect(reordered.map((stage) => stage.id)).toEqual(ids);
	});

	it("writes explicit positions for pipeline order", async () => {
		const a = await makePipeline("reorder-a");
		const b = await makePipeline("reorder-b");

		const reordered = await pipelines.reorderPipelines({
			ids: [b.id, a.id],
		});

		const bIndex = reordered.findIndex((entry) => entry.id === b.id);
		const aIndex = reordered.findIndex((entry) => entry.id === a.id);

		expect(bIndex).toBeLessThan(aIndex);
	});
});

describe("archivePipeline", () => {
	it("refuses when the pipeline holds open deals", async () => {
		const pipeline = await makePipeline("archive-open-deals");
		const entry = pipeline.stages.find((stage) => stage.isEntry);

		const deal = await db.deal.create({
			data: {
				name: `${prefix}_deal_open`,
				ownerId,
				stageId: entry?.id ?? "",
			},
			select: { id: true },
		});

		await expectRejects(pipelines.archivePipeline(pipeline.id), /open/i);

		await db.deal.delete({ where: { id: deal.id } });
	});

	it("allows archiving when deals are only in closed stages", async () => {
		const pipeline = await makePipeline("archive-closed-deals");
		const won = pipeline.stages.find(
			(stage) => stage.outcome === StageOutcome.WON,
		);

		const deal = await db.deal.create({
			data: {
				name: `${prefix}_deal_closed`,
				ownerId,
				stageId: won?.id ?? "",
				closedAt: new Date(),
			},
			select: { id: true },
		});

		const archived = await pipelines.archivePipeline(pipeline.id);
		expect(archived.archivedAt).not.toBeNull();

		await db.deal.delete({ where: { id: deal.id } });
	});

	it("restores a pipeline", async () => {
		const pipeline = await makePipeline("restore-me");
		await pipelines.archivePipeline(pipeline.id);

		const restored = await pipelines.restorePipeline(pipeline.id);
		expect(restored.archivedAt).toBeNull();
	});
});

describe("stageLabels", () => {
	it("includes archived stages by key", async () => {
		const pipeline = await makePipeline("labels");
		const stage = await pipelines.createStage({
			pipelineId: pipeline.id,
			label: "Temp stage",
			color: "var(--swatch-6)",
			outcome: StageOutcome.OPEN,
		});

		await pipelines.archiveStage(stage.id);

		const labels = await pipelines.stageLabels();

		expect(labels[stage.key]).toBe("Temp stage");
	});
});

describe("updatePipeline", () => {
	it("renames a pipeline", async () => {
		const pipeline = await makePipeline("rename");

		const updated = await pipelines.updatePipeline(pipeline.id, {
			name: `${prefix}_renamed`,
		});

		expect(updated.name).toBe(`${prefix}_renamed`);
	});
});
