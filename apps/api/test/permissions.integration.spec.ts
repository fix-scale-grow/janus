import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { PermissionsService } from "../src/permissions/permissions.service";

const suffix = process.env.TEST_RUN_ID ?? "permissions-spec";

const service = new PermissionsService(db);

let memberUserId: string;
let adminUserId: string;

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

	const member = await db.user.create({
		data: {
			id: `member-${suffix}`,
			name: "Test Member",
			email: `member-${suffix}@example.test`,
		},
		select: { id: true },
	});
	memberUserId = member.id;

	const admin = await db.user.create({
		data: {
			id: `admin-${suffix}`,
			name: "Test Admin",
			email: `admin-${suffix}@example.test`,
		},
		select: { id: true },
	});
	adminUserId = admin.id;

	await db.member.create({
		data: {
			id: `member-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: memberUserId,
			role: "member",
			createdAt: new Date(),
		},
	});

	await db.member.create({
		data: {
			id: `admin-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: adminUserId,
			role: "admin",
			createdAt: new Date(),
		},
	});
});

afterAll(async () => {
	await db.userPermission.deleteMany({
		where: { userId: { in: [memberUserId, adminUserId] } },
	});
	await db.member.deleteMany({
		where: { userId: { in: [memberUserId, adminUserId] } },
	});
	await db.user.deleteMany({
		where: { id: { in: [memberUserId, adminUserId] } },
	});
});

describe("PermissionsService", () => {
	it("grants and revokes profit.view for a member", async () => {
		const before = await service.hasPermission(memberUserId, "profit.view");
		expect(before).toBe(false);

		await service.grant(adminUserId, {
			userId: memberUserId,
			key: "profit.view",
		});

		const afterGrant = await service.hasPermission(
			memberUserId,
			"profit.view",
		);
		expect(afterGrant).toBe(true);

		await service.revoke(adminUserId, {
			userId: memberUserId,
			key: "profit.view",
		});

		const afterRevoke = await service.hasPermission(
			memberUserId,
			"profit.view",
		);
		expect(afterRevoke).toBe(false);
	});

	it("admin has every permission with no grant row", async () => {
		const hasIt = await service.hasPermission(adminUserId, "profit.view");
		expect(hasIt).toBe(true);
	});

	it("throws ForbiddenException when a member tries to grant", async () => {
		let thrownError: unknown;
		try {
			await service.grant(memberUserId, {
				userId: memberUserId,
				key: "profit.view",
			});
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeDefined();
		const err = thrownError as { message?: string };
		expect(err?.message).toBe("Only an admin can change permissions.");
	});

	it("mine returns all keys for an admin and only granted keys for a member", async () => {
		const adminMine = await service.mine(adminUserId);
		expect(adminMine.isAdmin).toBe(true);
		expect(adminMine.keys).toEqual(["profit.view"]);

		const memberMineBefore = await service.mine(memberUserId);
		expect(memberMineBefore.isAdmin).toBe(false);
		expect(memberMineBefore.keys).toEqual([]);

		await service.grant(adminUserId, {
			userId: memberUserId,
			key: "profit.view",
		});

		const memberMineAfter = await service.mine(memberUserId);
		expect(memberMineAfter.isAdmin).toBe(false);
		expect(memberMineAfter.keys).toEqual(["profit.view"]);
	});
});
