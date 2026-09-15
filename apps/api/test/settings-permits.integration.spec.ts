import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { PERMIT_DISCLAIMER_VERSION } from "@crm/db/permits";
import { ModelCatalogService } from "../src/settings/model-catalog.service";
import { SettingsService } from "../src/settings/settings.service";

const suffix = process.env.TEST_RUN_ID ?? "settings-permits-spec";

const service = new SettingsService(db, {} as ModelCatalogService);

let adminUserId: string;
let memberUserId: string;
let stageId: string;

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

beforeAll(async () => {
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: "Test",
			slug: `ws-${suffix}`,
			createdAt: new Date(),
		},
	});

	const admin = await db.user.create({
		data: {
			id: `permits-admin-${suffix}`,
			name: "Permits Admin",
			email: `permits-admin-${suffix}@example.test`,
		},
		select: { id: true },
	});
	adminUserId = admin.id;

	const member = await db.user.create({
		data: {
			id: `permits-member-${suffix}`,
			name: "Permits Member",
			email: `permits-member-${suffix}@example.test`,
		},
		select: { id: true },
	});
	memberUserId = member.id;

	await db.member.create({
		data: {
			id: `permits-admin-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: adminUserId,
			role: "admin",
			createdAt: new Date(),
		},
	});

	await db.member.create({
		data: {
			id: `permits-member-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: memberUserId,
			role: "member",
			createdAt: new Date(),
		},
	});

	const seededStage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	stageId = seededStage.id;
});

afterAll(async () => {
	await db.member.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId] } },
	});
	await db.user.deleteMany({
		where: { id: { in: [adminUserId, memberUserId] } },
	});
	await db.appSetting.updateMany({
		data: {
			permitsEnabled: false,
			permitStates: [],
			permitTriggerStageIds: [],
			permitDisclaimerVersion: null,
			permitDisclaimerAcceptedById: null,
			permitDisclaimerAcceptedAt: null,
		},
	});
});

describe("SettingsService permits", () => {
	it("permits defaults to disabled, and setPermits round-trips", async () => {
		const before = await service.permits();
		expect(before.permitsEnabled).toBe(false);
		expect(before.permitStates).toEqual([]);
		expect(before.permitTriggerStageIds).toEqual([]);
		expect(before.disclaimer).toBeNull();

		const after = await service.setPermits(adminUserId, {
			enabled: true,
			states: ["CO", "TX"],
			triggerStageIds: [stageId],
		});
		expect(after.permitsEnabled).toBe(true);
		expect(after.permitStates).toEqual(["CO", "TX"]);
		expect(after.permitTriggerStageIds).toEqual([stageId]);

		const read = await service.permits();
		expect(read.permitsEnabled).toBe(true);
		expect(read.permitStates).toEqual(["CO", "TX"]);
		expect(read.permitTriggerStageIds).toEqual([stageId]);
	});

	it("defaults triggerStageIds to every WON stage on first enable when none is supplied", async () => {
		await service.setPermits(adminUserId, {
			enabled: false,
			triggerStageIds: [],
		});

		const wonStages = await db.stage.findMany({
			where: { outcome: "WON", archivedAt: null },
			select: { id: true },
		});

		const after = await service.setPermits(adminUserId, { enabled: true });
		expect(new Set(after.permitTriggerStageIds)).toEqual(
			new Set(wonStages.map((stage) => stage.id)),
		);

		await service.setPermits(adminUserId, {
			enabled: false,
			triggerStageIds: [],
		});
	});

	it("does not override an explicit triggerStageIds on first enable", async () => {
		await service.setPermits(adminUserId, {
			enabled: false,
			triggerStageIds: [],
		});

		const after = await service.setPermits(adminUserId, {
			enabled: true,
			triggerStageIds: [stageId],
		});
		expect(after.permitTriggerStageIds).toEqual([stageId]);

		await service.setPermits(adminUserId, {
			enabled: false,
			triggerStageIds: [],
		});
	});

	it("does not repopulate triggerStageIds once it is already non-empty", async () => {
		await service.setPermits(adminUserId, {
			enabled: false,
			triggerStageIds: [stageId],
		});

		const after = await service.setPermits(adminUserId, { enabled: true });
		expect(after.permitTriggerStageIds).toEqual([stageId]);

		await service.setPermits(adminUserId, {
			enabled: false,
			triggerStageIds: [],
		});
	});

	it("setPermits rejects a non-admin", async () => {
		await expectRejects(
			service.setPermits(memberUserId, { enabled: true }),
			/owner or an admin/,
		);
	});

	it("setPermits rejects an unknown stage id", async () => {
		await expectRejects(
			service.setPermits(adminUserId, {
				triggerStageIds: [`missing-stage-${suffix}`],
			}),
			/Unknown stage/,
		);
	});

	it("acceptPermitDisclaimer stamps once, and a re-accept at the same version is a no-op", async () => {
		const first = await service.acceptPermitDisclaimer(adminUserId);
		expect(first.disclaimer).not.toBeNull();
		expect(first.disclaimer?.acceptedById).toBe(adminUserId);
		expect(first.disclaimer?.version).toBe(PERMIT_DISCLAIMER_VERSION);

		const acceptedAt = first.disclaimer?.acceptedAt;

		const second = await service.acceptPermitDisclaimer(memberUserId);
		expect(second.disclaimer?.acceptedById).toBe(adminUserId);
		expect(second.disclaimer?.acceptedAt).toEqual(acceptedAt as Date);
		expect(second.disclaimer?.version).toBe(PERMIT_DISCLAIMER_VERSION);
	});
});
