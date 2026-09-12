import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { ResearchKeyService } from "../src/agent/research-key.service";
import { BackfillService } from "../src/backfill/backfill.service";
import { ModelCatalogService } from "../src/settings/model-catalog.service";
import { SettingsService } from "../src/settings/settings.service";

const suffix = process.env.TEST_RUN_ID ?? "settings-nav-spec";

const service = new SettingsService(
	db,
	{} as ModelCatalogService,
	{} as ResearchKeyService,
	{} as BackfillService,
);

let adminUserId: string;
let memberUserId: string;
let seededStageId: string;
const dealIds: string[] = [];

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
			id: `nav-admin-${suffix}`,
			name: "Nav Admin",
			email: `nav-admin-${suffix}@example.test`,
		},
		select: { id: true },
	});
	adminUserId = admin.id;

	const member = await db.user.create({
		data: {
			id: `nav-member-${suffix}`,
			name: "Nav Member",
			email: `nav-member-${suffix}@example.test`,
		},
		select: { id: true },
	});
	memberUserId = member.id;

	await db.member.create({
		data: {
			id: `nav-admin-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: adminUserId,
			role: "admin",
			createdAt: new Date(),
		},
	});

	await db.member.create({
		data: {
			id: `nav-member-row-${suffix}`,
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
	seededStageId = seededStage.id;
});

afterAll(async () => {
	await db.deal.deleteMany({ where: { id: { in: dealIds } } });
	await db.member.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId] } },
	});
	await db.user.deleteMany({
		where: { id: { in: [adminUserId, memberUserId] } },
	});
	await db.appSetting.updateMany({
		data: { navLayout: null, dealNumberStart: null },
	});
});

describe("SettingsService nav layout", () => {
	it("navLayout defaults to RAIL, and setNavLayout persists", async () => {
		const before = await service.navLayout();
		expect(before.layout).toBe("RAIL");

		const after = await service.setNavLayout(adminUserId, "TOP_BAR");
		expect(after.layout).toBe("TOP_BAR");

		const read = await service.navLayout();
		expect(read.layout).toBe("TOP_BAR");

		await service.setNavLayout(adminUserId, "RAIL");
	});

	it("setNavLayout rejects a non-admin", async () => {
		await expectRejects(
			service.setNavLayout(memberUserId, "TOP_BAR"),
			/owner or an admin/,
		);
	});
});

describe("SettingsService deal numbering", () => {
	it("setDealNumberStart rejects a start at or below the highest existing number", async () => {
		const dealId = `nav-deal-${suffix}`;
		await db.deal.create({
			data: {
				id: dealId,
				name: `Nav Deal ${suffix}`,
				ownerId: adminUserId,
				currency: "USD",
				stageId: seededStageId,
			},
			select: { id: true, number: true },
		});
		dealIds.push(dealId);

		const created = await db.deal.findUniqueOrThrow({
			where: { id: dealId },
			select: { number: true },
		});

		await expectRejects(
			service.setDealNumberStart(adminUserId, created.number),
			new RegExp(`highest number is ${created.number}`),
		);
	});

	it("setDealNumberStart rejects a non-admin", async () => {
		await expectRejects(
			service.setDealNumberStart(memberUserId, 90_000),
			/owner or an admin/,
		);
	});

	it("an accepted start makes the next created deal get exactly that number", async () => {
		const maxRow = await db.deal.aggregate({ _max: { number: true } });
		const start = (maxRow._max.number ?? 0) + 1000;

		const result = await service.setDealNumberStart(adminUserId, start);
		expect(result.nextNumber).toBe(start);

		const dealId = `nav-deal-numbered-${suffix}`;
		const created = await db.deal.create({
			data: {
				id: dealId,
				name: `Nav Deal Numbered ${suffix}`,
				ownerId: adminUserId,
				currency: "USD",
				stageId: seededStageId,
			},
			select: { id: true, number: true },
		});
		dealIds.push(dealId);

		expect(created.number).toBe(start);
	});
});
