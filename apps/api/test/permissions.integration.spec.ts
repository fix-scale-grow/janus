import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
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
});
