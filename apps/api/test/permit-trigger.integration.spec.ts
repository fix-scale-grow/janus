import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import type { Db } from "@crm/db";
import { db } from "@crm/db";
import { writePermitSettings } from "@crm/db/settings";
import { Logger } from "@nestjs/common";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { PermitTriggerService } from "../src/permits/permit-trigger.service";

const suffix = process.env.TEST_RUN_ID ?? "permit-trigger-spec";

const agentTrigger = new AgentTriggerService(db);
const permitTrigger = new PermitTriggerService(db, agentTrigger);

let userId: string;
let triggerStageId: string;
let otherStageId: string;

async function makeDeal(name: string, stageId: string) {
	return db.deal.create({
		data: { name, ownerId: userId, stageId },
		select: { id: true },
	});
}

async function taskCount(dealId: string): Promise<number> {
	return db.agentTask.count({ where: { kind: "permit-research", dealId } });
}

beforeAll(async () => {
	const user = await db.user.create({
		data: {
			id: `permit-trigger-user-${suffix}`,
			name: "Permit Trigger Rep",
			email: `permit-trigger-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	const trigger = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	triggerStageId = trigger.id;

	const other = await db.stage.findFirstOrThrow({
		where: { key: "QUALIFIED_TO_BUY" },
		select: { id: true },
	});
	otherStageId = other.id;

	await writePermitSettings(db, {
		permitsEnabled: true,
		permitTriggerStageIds: [triggerStageId],
	});
});

afterAll(async () => {
	await db.agentTask.deleteMany({ where: { kind: "permit-research" } });
	await db.permit.deleteMany({ where: { deal: { ownerId: userId } } });
	await db.deal.deleteMany({ where: { ownerId: userId } });
	await db.user.deleteMany({ where: { id: userId } });
	await writePermitSettings(db, {
		permitsEnabled: false,
		permitTriggerStageIds: [],
	});
});

describe("PermitTriggerService.onStageChanged", () => {
	it("queues exactly one agent task across a double call, on a trigger stage with no permit", async () => {
		const deal = await makeDeal(`Trigger ${suffix}`, triggerStageId);

		await permitTrigger.onStageChanged(deal.id, triggerStageId);
		await permitTrigger.onStageChanged(deal.id, triggerStageId);

		expect(await taskCount(deal.id)).toBe(1);
	});

	it("queues nothing on a non-trigger stage", async () => {
		const deal = await makeDeal(`Non trigger ${suffix}`, otherStageId);

		await permitTrigger.onStageChanged(deal.id, otherStageId);

		expect(await taskCount(deal.id)).toBe(0);
	});

	it("queues nothing while the feature is off", async () => {
		const deal = await makeDeal(`Feature off ${suffix}`, triggerStageId);

		await writePermitSettings(db, { permitsEnabled: false });
		try {
			await permitTrigger.onStageChanged(deal.id, triggerStageId);
			expect(await taskCount(deal.id)).toBe(0);
		} finally {
			await writePermitSettings(db, { permitsEnabled: true });
		}
	});

	it("queues nothing when the deal already has a permit", async () => {
		const deal = await makeDeal(`Existing permit ${suffix}`, triggerStageId);
		const jurisdiction = await db.jurisdiction.create({
			data: {
				name: `Permit Trigger City ${suffix}`,
				kind: "CITY",
				state: "CO",
				matchKey: `co:city:permit trigger city ${suffix}`,
			},
		});
		const playbook = await db.permitPlaybook.create({
			data: { jurisdictionId: jurisdiction.id, permitType: "ROOFING" },
		});
		const permit = await db.permit.create({
			data: {
				dealId: deal.id,
				jurisdictionId: jurisdiction.id,
				playbookId: playbook.id,
				permitType: "ROOFING",
				typeLabel: "",
				createdById: userId,
			},
		});

		await permitTrigger.onStageChanged(deal.id, triggerStageId);

		expect(await taskCount(deal.id)).toBe(0);

		await db.permit.deleteMany({ where: { id: permit.id } });
		await db.permitPlaybook.deleteMany({ where: { id: playbook.id } });
		await db.jurisdiction.deleteMany({ where: { id: jurisdiction.id } });
	});

	it("swallows a thrown db error and logs it, without throwing", async () => {
		const errorSpy = spyOn(Logger.prototype, "error").mockImplementation(
			() => undefined,
		);

		const brokenDb = {
			appSetting: {
				findUnique: async () => {
					throw new Error("db is down");
				},
			},
		} as unknown as Db;

		const broken = new PermitTriggerService(brokenDb, agentTrigger);

		try {
			await expect(
				broken.onStageChanged("missing-deal", triggerStageId),
			).resolves.toBeUndefined();

			expect(errorSpy).toHaveBeenCalled();
		} finally {
			errorSpy.mockRestore();
		}
	});
});
