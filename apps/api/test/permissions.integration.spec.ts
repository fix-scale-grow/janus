import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	ACCESS_AREAS,
	MONEY_SWITCHES,
	STANDALONE_ACTIONS,
} from "@crm/db/access-config";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { resolvePrincipal } from "@crm/db/access-resolve";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { PermissionsService } from "../src/permissions/permissions.service";

const suffix = process.env.TEST_RUN_ID ?? "permissions-spec";

const permissions = new PermissionsService();

let f: AccessFixture;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
});

afterAll(async () => {
	await f.cleanup();
});

describe("permissions.mine", () => {
	test("an admin gets isAdmin and the full policy, no group", () => {
		const mine = permissions.mine(f.admin);
		expect(mine.isAdmin).toBe(true);
		expect(mine.groupId).toBeNull();
		expect(mine.groupName).toBeNull();
		expect(mine.surface).toBe("FULL");
		expect(mine.scope).toBe("ALL");
		expect(Object.values(mine.areas)).toEqual(ACCESS_AREAS.map(() => "DELETE"));
		expect(mine.actions).toEqual([...STANDALONE_ACTIONS]);
		expect(mine.money).toEqual([...MONEY_SWITCHES]);
	});

	test("a group member gets the group's flattened policy", () => {
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

	test("an ungrouped member gets no access", async () => {
		const userId = `acc-mine-ungrouped-${suffix}`;
		await db.user.create({
			data: { id: userId, name: userId, email: `${userId}@example.test` },
		});
		const member = await db.member.create({
			data: {
				id: `m-${userId}`,
				organizationId: WORKSPACE_ID,
				userId,
				role: "member",
				groupId: null,
				createdAt: new Date(),
			},
		});

		try {
			const principal = await resolvePrincipal(db, userId);
			if (!principal) throw new Error("principal missing");
			const mine = permissions.mine(principal);
			expect(mine.isAdmin).toBe(false);
			expect(mine.groupId).toBeNull();
			expect(mine.groupName).toBeNull();
			expect(Object.values(mine.areas)).toEqual(
				ACCESS_AREAS.map(() => "HIDDEN"),
			);
			expect(mine.actions).toEqual([]);
			expect(mine.money).toEqual([]);
		} finally {
			await db.member.deleteMany({ where: { id: member.id } });
			await db.user.deleteMany({ where: { id: userId } });
		}
	});
});
