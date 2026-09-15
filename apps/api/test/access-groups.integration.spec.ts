import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import { ACCESS } from "@crm/db/access-config";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { parseAccessPolicy } from "@crm/db/access-policy";
import { resolvePrincipal } from "@crm/db/access-resolve";
import { WORKSPACE_ID } from "@crm/db/workspace";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import { AccessService } from "../src/access/access.service";
import { AccessGroupsService } from "../src/access-groups/access-groups.service";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { PermissionsService } from "../src/permissions/permissions.service";
import { WorkspaceService } from "../src/workspace/workspace.service";

const suffix = process.env.TEST_RUN_ID ?? "access-groups-spec";

const access = new AccessService(db);
const groups = new AccessGroupsService(db, access);
const permissions = new PermissionsService();
const agent = {
	workspaceChanged: async () => undefined,
} as unknown as AgentTriggerService;
const workspace = new WorkspaceService(db, agent);

let f: AccessFixture;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
});

afterAll(async () => {
	await f.cleanup();
});

async function expectForbidden(run: () => Promise<unknown>) {
	let thrown: unknown;
	try {
		await run();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(ForbiddenException);
}

async function expectConflict(run: () => Promise<unknown>) {
	let thrown: unknown;
	try {
		await run();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(ConflictException);
}

async function expectBadRequest(run: () => Promise<unknown>) {
	let thrown: unknown;
	try {
		await run();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(BadRequestException);
}

async function expectNotFound(run: () => Promise<unknown>) {
	let thrown: unknown;
	try {
		await run();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(NotFoundException);
}

async function createMember(
	userId: string,
	data: { role: string; groupId: string | null },
) {
	await db.user.create({
		data: { id: userId, name: userId, email: `${userId}@example.test` },
	});
	return db.member.create({
		data: {
			id: `m-${userId}`,
			organizationId: WORKSPACE_ID,
			userId,
			role: data.role,
			groupId: data.groupId,
			createdAt: new Date(),
		},
	});
}

async function deleteMember(memberId: string, userId: string) {
	await db.member.deleteMany({ where: { id: memberId } });
	await db.user.deleteMany({ where: { id: userId } });
}

describe("access groups", () => {
	test("admin creates, updates and lists a group", async () => {
		const policy = parseAccessPolicy(ACCESS.seedGroups[0]?.policy, "t");
		const { id } = await groups.create(
			{ name: `Estimator ${suffix}`, surface: "FULL", scope: "OWN", policy },
			f.admin,
		);
		const updated = await groups.update(
			{
				id,
				name: `Estimator ${suffix}`,
				surface: "FULL",
				scope: "ALL",
				policy,
			},
			f.admin,
		);
		expect(updated.affected).toBe(0);
		const row = (await groups.list(f.admin)).find((g) => g.id === id);
		expect(row?.scope).toBe("ALL");
		await groups.delete({ id }, f.admin);
	});

	test("group member cannot manage groups", async () => {
		await expectForbidden(() => groups.list(f.clerk));
	});

	test("cannot delete a group with people", async () => {
		await expectConflict(() =>
			groups.delete({ id: f.clerk.groupId as string }, f.admin),
		);
	});

	test("duplicate name is refused", async () => {
		const policy = parseAccessPolicy(ACCESS.seedGroups[0]?.policy, "t");
		await expectConflict(() =>
			groups.create(
				{ name: "Office", surface: "FULL", scope: "ALL", policy },
				f.admin,
			),
		);
	});

	test("update rejects an invalid policy with BadRequestException", async () => {
		const office = await db.accessGroup.findFirstOrThrow({
			where: { seedKey: "office" },
		});
		await expectBadRequest(() =>
			groups.update(
				{
					id: office.id,
					name: "Office",
					surface: "FULL",
					scope: "ALL",
					policy: { areas: {}, actions: [], money: [] } as never,
				},
				f.admin,
			),
		);
	});

	test("move clerk into Office changes their principal", async () => {
		const office = await db.accessGroup.findFirstOrThrow({
			where: { seedKey: "office" },
		});
		const member = await db.member.findFirstOrThrow({
			where: { userId: f.clerkId },
		});
		try {
			await groups.setMemberAccess(
				{ memberId: member.id, access: { kind: "group", groupId: office.id } },
				f.admin,
			);
			expect((await resolvePrincipal(db, f.clerkId))?.groupName).toBe("Office");
		} finally {
			await groups.setMemberAccess(
				{
					memberId: member.id,
					access: { kind: "group", groupId: f.clerk.groupId as string },
				},
				f.admin,
			);
		}
	});

	test("mine returns the flattened policy", async () => {
		const mine = permissions.mine(f.clerk);
		expect(mine).toEqual({
			isAdmin: false,
			groupId: f.clerk.groupId,
			groupName: "Sales clerk",
			surface: "FULL",
			scope: "OWN",
			areas: f.clerk.policy.areas,
			actions: [],
			money: ["prices"],
		});
	});

	test("setMemberRole to member without a group is refused", async () => {
		const userId = `acc-groupless-${suffix}`;
		const member = await createMember(userId, {
			role: "admin",
			groupId: null,
		});

		try {
			await expectBadRequest(() =>
				workspace.setMemberRole(f.adminId, {
					memberId: member.id,
					role: "member",
				}),
			);
		} finally {
			await deleteMember(member.id, userId);
		}
	});

	test("setMemberRole promoting to admin clears groupId", async () => {
		const userId = `acc-promoted-${suffix}`;
		const office = await db.accessGroup.findFirstOrThrow({
			where: { seedKey: "office" },
		});
		const member = await createMember(userId, {
			role: "member",
			groupId: office.id,
		});

		try {
			await workspace.setMemberRole(f.adminId, {
				memberId: member.id,
				role: "admin",
			});
			const row = await db.member.findUniqueOrThrow({
				where: { id: member.id },
				select: { groupId: true, role: true },
			});
			expect(row.role).toBe("admin");
			expect(row.groupId).toBeNull();
		} finally {
			await deleteMember(member.id, userId);
		}
	});

	describe("setMemberAccess", () => {
		test("non-admin principal is refused", async () => {
			const member = await db.member.findFirstOrThrow({
				where: { userId: f.clerkId },
			});
			await expectForbidden(() =>
				groups.setMemberAccess(
					{ memberId: member.id, access: { kind: "admin" } },
					f.clerk,
				),
			);
		});

		test("unknown memberId is a NotFoundException", async () => {
			await expectNotFound(() =>
				groups.setMemberAccess(
					{ memberId: "does-not-exist", access: { kind: "admin" } },
					f.admin,
				),
			);
		});

		test("unknown groupId is a NotFoundException", async () => {
			const member = await db.member.findFirstOrThrow({
				where: { userId: f.clerkId },
			});
			await expectNotFound(() =>
				groups.setMemberAccess(
					{
						memberId: member.id,
						access: { kind: "group", groupId: "does-not-exist" },
					},
					f.admin,
				),
			);
		});

		test("refuses an owner target via kind admin", async () => {
			const userId = `acc-owner-admin-${suffix}`;
			const member = await createMember(userId, {
				role: "owner",
				groupId: null,
			});

			try {
				await expectForbidden(() =>
					groups.setMemberAccess(
						{ memberId: member.id, access: { kind: "admin" } },
						f.admin,
					),
				);
			} finally {
				await deleteMember(member.id, userId);
			}
		});

		test("refuses an owner target via kind group", async () => {
			const userId = `acc-owner-group-${suffix}`;
			const office = await db.accessGroup.findFirstOrThrow({
				where: { seedKey: "office" },
			});
			const member = await createMember(userId, {
				role: "owner",
				groupId: null,
			});

			try {
				await expectForbidden(() =>
					groups.setMemberAccess(
						{
							memberId: member.id,
							access: { kind: "group", groupId: office.id },
						},
						f.admin,
					),
				);
			} finally {
				await deleteMember(member.id, userId);
			}
		});

		test("kind admin clears groupId", async () => {
			const userId = `acc-to-admin-${suffix}`;
			const office = await db.accessGroup.findFirstOrThrow({
				where: { seedKey: "office" },
			});
			const member = await createMember(userId, {
				role: "member",
				groupId: office.id,
			});

			try {
				await groups.setMemberAccess(
					{ memberId: member.id, access: { kind: "admin" } },
					f.admin,
				);
				const row = await db.member.findUniqueOrThrow({
					where: { id: member.id },
					select: { role: true, groupId: true },
				});
				expect(row.role).toBe("admin");
				expect(row.groupId).toBeNull();
			} finally {
				await deleteMember(member.id, userId);
			}
		});
	});
});
