import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { demoContactRole, seedPipelines } from "../prisma/demo-data";
import { db } from "../src/client";
import { StageOutcome } from "../src/generated/prisma/enums";

const suffix = process.env.TEST_RUN_ID ?? "demo-pipelines-spec";
const OWN_PIPELINE_ID = `own-insurance-${suffix}`;
const SEED_INSURANCE_ID = "pipeline_seed_insurance";

async function removeInsurancePipelines(): Promise<void> {
	const ids = [OWN_PIPELINE_ID, SEED_INSURANCE_ID];
	const deals = await db.deal.count({
		where: { stage: { pipelineId: { in: ids } } },
	});
	if (deals > 0) {
		throw new Error(
			`The test database has ${deals} deals in an Insurance fixture pipeline. Clean it first.`,
		);
	}
	await db.stage.deleteMany({ where: { pipelineId: { in: ids } } });
	await db.pipeline.deleteMany({ where: { id: { in: ids } } });
}

async function assertNoOtherInsurance(): Promise<void> {
	const others = await db.pipeline.count({
		where: {
			name: "Insurance",
			archivedAt: null,
			id: { notIn: [OWN_PIPELINE_ID, SEED_INSURANCE_ID] },
		},
	});
	if (others > 0) {
		throw new Error(
			"The test database has another active Insurance pipeline. Clean it first.",
		);
	}
}

function stageOrder(pipelineId: string) {
	return db.stage.findMany({
		where: { pipelineId },
		orderBy: [{ position: "asc" }, { id: "asc" }],
		select: {
			id: true,
			key: true,
			position: true,
			label: true,
			outcome: true,
			isEntry: true,
		},
	});
}

beforeAll(async () => {
	await removeInsurancePipelines();
	await assertNoOtherInsurance();
});

afterAll(async () => {
	await removeInsurancePipelines();
});

describe("seedPipelines", () => {
	it("maps seed stages onto an existing pipeline's own stages and adds none", async () => {
		await db.pipeline.create({
			data: {
				id: OWN_PIPELINE_ID,
				name: "Insurance",
				position: 9,
				stages: {
					create: [
						{
							key: "new_lead",
							label: "New lead",
							color: "var(--chart-1)",
							position: 0,
							outcome: StageOutcome.OPEN,
							isEntry: true,
						},
						{
							key: "won",
							label: "Won",
							color: "var(--swatch-1)",
							position: 1,
							outcome: StageOutcome.WON,
						},
						{
							key: "lost",
							label: "Lost",
							color: "var(--swatch-2)",
							position: 2,
							outcome: StageOutcome.LOST,
						},
					],
				},
			},
		});
		const before = await stageOrder(OWN_PIPELINE_ID);

		const first = await seedPipelines();
		const second = await seedPipelines();

		expect(await stageOrder(OWN_PIPELINE_ID)).toEqual(before);
		expect(
			await db.pipeline.findUnique({ where: { id: SEED_INSURANCE_ID } }),
		).toBeNull();

		const byKey = (key: string) => before.find((stage) => stage.key === key);
		const seeded = [...first.open, ...first.closed].filter(
			(stage) => stage.seedPipelineId === SEED_INSURANCE_ID,
		);
		expect(seeded).toHaveLength(5);
		for (const stage of seeded) expect(stage.pipelineId).toBe(OWN_PIPELINE_ID);
		const mapped: Record<string, string | undefined> = Object.fromEntries(
			seeded.map((stage) => [stage.seedKey, stage.id]),
		);
		expect(mapped).toEqual({
			NEW_CLAIM: byKey("new_lead")?.id,
			ADJUSTER_MEETING: byKey("new_lead")?.id,
			APPROVED: byKey("new_lead")?.id,
			CLAIM_WON: byKey("won")?.id,
			CLAIM_LOST: byKey("lost")?.id,
		});
		expect(first.entryKeyByPipelineId[OWN_PIPELINE_ID]).toBe("new_lead");
		expect(second).toEqual(first);

		await removeInsurancePipelines();
	});

	it("creates the seed stages in order only when the pipeline has none", async () => {
		const first = await seedPipelines();

		expect(
			(await stageOrder(SEED_INSURANCE_ID)).map((stage) => [
				stage.position,
				stage.label,
				stage.outcome,
				stage.isEntry,
			]),
		).toEqual([
			[0, "New claim", StageOutcome.OPEN, true],
			[1, "Adjuster meeting", StageOutcome.OPEN, false],
			[2, "Approved", StageOutcome.OPEN, false],
			[3, "Won", StageOutcome.WON, false],
			[4, "Lost", StageOutcome.LOST, false],
		]);

		const second = await seedPipelines();
		expect(second).toEqual(first);
		expect(await stageOrder(SEED_INSURANCE_ID)).toHaveLength(5);
	});
});

describe("demoContactRole", () => {
	it("uses trade roles and never SaaS sales roles", () => {
		expect(demoContactRole(null)).toBe("Homeowner");
		expect(demoContactRole("Oak Ridge HOA")).toBe("Property manager");
		expect(demoContactRole("Hartley Builders")).toBe("General contractor");
		expect(demoContactRole("Some Other Company")).toBe("Property manager");
	});
});
