import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { demoContactRole, seedPipelines } from "../prisma/demo-data";
import { db } from "../src/client";
import { StageOutcome } from "../src/generated/prisma/enums";

const suffix = process.env.TEST_RUN_ID ?? "demo-pipelines-spec";
const OWN_PIPELINE_ID = `own-insurance-${suffix}`;
const SEED_INSURANCE_ID = "pipeline_seed_insurance";

let seedInsuranceExisted = false;

beforeAll(async () => {
	seedInsuranceExisted =
		(await db.pipeline.findUnique({ where: { id: SEED_INSURANCE_ID } })) !==
		null;
	if (seedInsuranceExisted) return;

	await db.pipeline.create({
		data: {
			id: OWN_PIPELINE_ID,
			name: "Insurance",
			position: 9,
			createdAt: new Date("2020-01-01T00:00:00.000Z"),
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
});

afterAll(async () => {
	if (seedInsuranceExisted) return;
	await db.stage.deleteMany({
		where: { pipelineId: { in: [OWN_PIPELINE_ID, SEED_INSURANCE_ID] } },
	});
	await db.pipeline.deleteMany({
		where: { id: { in: [OWN_PIPELINE_ID, SEED_INSURANCE_ID] } },
	});
});

describe("seedPipelines", () => {
	it("reuses an existing pipeline with the same name instead of adding a second one", async () => {
		if (seedInsuranceExisted) return;

		const first = await seedPipelines();
		const second = await seedPipelines();

		const insurance = await db.pipeline.findMany({
			where: { name: "Insurance", archivedAt: null },
			select: { id: true },
		});
		expect(insurance.map((row) => row.id)).toEqual([OWN_PIPELINE_ID]);

		const stages = await db.stage.findMany({
			where: { pipelineId: OWN_PIPELINE_ID },
			select: { label: true, outcome: true, isEntry: true },
		});
		expect(stages.filter((stage) => stage.label === "Won")).toHaveLength(1);
		expect(stages.filter((stage) => stage.label === "Lost")).toHaveLength(1);
		expect(stages.filter((stage) => stage.isEntry)).toHaveLength(1);

		const seededIn = [...first.open, ...first.closed].filter(
			(stage) => stage.pipelineId === OWN_PIPELINE_ID,
		);
		expect(seededIn.length).toBeGreaterThan(0);
		expect(first.entryKeyByPipelineId[OWN_PIPELINE_ID]).toBe("new_lead");
		expect(second).toEqual(first);
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
