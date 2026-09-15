import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { ForbiddenException } from "@nestjs/common";
import { AccessService } from "../src/access/access.service";

const suffix = process.env.TEST_RUN_ID ?? "access-service";
const service = new AccessService(db);
const clerkId = `clerk-${suffix}`;
const outsiderId = `outsider-${suffix}`;

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
	await db.user.createMany({
		data: [
			{ id: clerkId, name: "Clerk", email: `${clerkId}@example.test` },
			{ id: outsiderId, name: "Outsider", email: `${outsiderId}@example.test` },
		],
	});
	const { ensureAccessGroups } = await import("@crm/db/access-resolve");
	await ensureAccessGroups(db);
	const clerk = await db.accessGroup.findFirstOrThrow({
		where: { seedKey: "sales-clerk" },
	});
	await db.member.create({
		data: {
			id: `m-${clerkId}`,
			organizationId: WORKSPACE_ID,
			userId: clerkId,
			role: "member",
			groupId: clerk.id,
			createdAt: new Date(),
		},
	});
});

afterAll(async () => {
	await db.member.deleteMany({
		where: { userId: { in: [clerkId, outsiderId] } },
	});
	await db.user.deleteMany({ where: { id: { in: [clerkId, outsiderId] } } });
});

async function expectForbidden(run: () => unknown, message: string) {
	try {
		await run();
		throw new Error("expected ForbiddenException");
	} catch (error) {
		expect(error).toBeInstanceOf(ForbiddenException);
		expect((error as Error).message).toBe(message);
	}
}

describe("AccessService", () => {
	test("resolves the clerk", async () => {
		const p = await service.principal(clerkId);
		expect(p.groupName).toBe("Sales clerk");
	});

	test("assert refuses with the group message", async () => {
		const p = await service.principal(clerkId);
		await expectForbidden(
			() => service.assert(p, "invoices", "VIEW"),
			"Your group (Sales clerk) can't view invoices. Ask an admin.",
		);
	});

	test("non-member is refused", async () => {
		await expectForbidden(
			() => service.principal(outsiderId),
			"You are not a member of this workspace.",
		);
	});

	test("assertAdmin refuses a group member", async () => {
		const p = await service.principal(clerkId);
		await expectForbidden(
			() => service.assertAdmin(p),
			"Only an owner or an admin can do this.",
		);
	});
});
