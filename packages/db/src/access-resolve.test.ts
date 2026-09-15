import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ACCESS } from "./access-config";
import {
	ensureAccessGroups,
	ensureAccessGroupsOnce,
	resolvePrincipal,
} from "./access-resolve";
import { db } from "./client";
import { WORKSPACE_ID } from "./workspace";

const suffix = process.env.TEST_RUN_ID ?? "access-resolve";
const ids = {
	owner: `owner-${suffix}`,
	plain: `plain-${suffix}`,
	profit: `profit-${suffix}`,
	late: `late-${suffix}`,
	waiting: `waiting-${suffix}`,
};

async function clearSeedMarker() {
	await db.appSetting.updateMany({ data: { accessGroupsSeededAt: null } });
}

async function member(userId: string, role: string) {
	await db.user.create({
		data: { id: userId, name: userId, email: `${userId}@example.test` },
	});
	await db.member.create({
		data: {
			id: `m-${userId}`,
			organizationId: WORKSPACE_ID,
			userId,
			role,
			createdAt: new Date(),
		},
	});
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
	await db.member.updateMany({
		where: { groupId: { not: null } },
		data: { groupId: null },
	});
	await db.accessGroup.deleteMany({});
	await clearSeedMarker();
	await member(ids.owner, "owner");
	await member(ids.plain, "member");
	await member(ids.profit, "member");
	await db.userPermission.create({
		data: { userId: ids.profit, key: "profit.view", grantedById: ids.owner },
	});
});

afterAll(async () => {
	const users = Object.values(ids);
	await db.userPermission.deleteMany({ where: { userId: { in: users } } });
	await db.member.deleteMany({ where: { userId: { in: users } } });
	await db.user.deleteMany({ where: { id: { in: users } } });
	await db.member.updateMany({
		where: { groupId: { not: null } },
		data: { groupId: null },
	});
	await db.accessGroup.deleteMany({});
	await clearSeedMarker();
});

describe("resolvePrincipal", () => {
	test("owner is admin", async () => {
		const p = await resolvePrincipal(db, ids.owner);
		expect(p?.isAdmin).toBe(true);
	});

	test("first seeding creates seed groups and places plain members", async () => {
		await ensureAccessGroups(db);
		const names = (await db.accessGroup.findMany({ select: { name: true } }))
			.map((g) => g.name)
			.sort();
		expect(names).toEqual(
			[
				...ACCESS.seedGroups.map((g) => g.name),
				ACCESS.legacyProfitGroupName,
			].sort(),
		);
		const plain = await resolvePrincipal(db, ids.plain);
		expect(plain?.groupName).toBe("Office");
		const profit = await resolvePrincipal(db, ids.profit);
		expect(profit?.groupName).toBe(ACCESS.legacyProfitGroupName);
		expect(profit?.policy.money).toContain("profit");
	});

	test("seeding is idempotent", async () => {
		await ensureAccessGroups(db);
		expect(await db.accessGroup.count()).toBe(ACCESS.seedGroups.length + 1);
	});

	test("members who join after seeding have no access", async () => {
		await member(ids.late, "member");
		const late = await resolvePrincipal(db, ids.late);
		expect(late?.groupId).toBeNull();
		expect(late?.policy.areas.deals).toBe("HIDDEN");
	});

	test("seeding writes a permanent marker", async () => {
		const row = await db.appSetting.findUnique({
			where: { id: "app" },
			select: { accessGroupsSeededAt: true },
		});
		expect(row?.accessGroupsSeededAt).toBeInstanceOf(Date);
	});

	test("deleting every group never reseeds or regroups waiting members", async () => {
		await db.member.updateMany({
			where: { groupId: { not: null } },
			data: { groupId: null },
		});
		await db.accessGroup.deleteMany({});
		await member(ids.waiting, "member");

		await ensureAccessGroups(db);

		expect(await db.accessGroup.count()).toBe(0);
		const waiting = await resolvePrincipal(db, ids.waiting);
		expect(waiting?.groupId).toBeNull();
		expect(waiting?.policy.areas.deals).toBe("HIDDEN");
	});

	test("an install with groups but no marker gets the marker without reseeding", async () => {
		await db.accessGroup.create({
			data: {
				name: `Existing ${suffix}`,
				surface: "FULL",
				scope: "OWN",
				policy: { areas: {}, actions: [], money: [] },
			},
		});
		await clearSeedMarker();

		await ensureAccessGroups(db);

		expect(await db.accessGroup.count()).toBe(1);
		const row = await db.appSetting.findUnique({
			where: { id: "app" },
			select: { accessGroupsSeededAt: true },
		});
		expect(row?.accessGroupsSeededAt).toBeInstanceOf(Date);
		const waiting = await resolvePrincipal(db, ids.waiting);
		expect(waiting?.groupId).toBeNull();
	});

	test("seeding once per process reuses one pending run per client", async () => {
		const first = ensureAccessGroupsOnce(db);
		const second = ensureAccessGroupsOnce(db);
		expect(second).toBe(first);
		await first;
	});

	test("non-member resolves null", async () => {
		expect(await resolvePrincipal(db, "nobody")).toBeNull();
	});
});
