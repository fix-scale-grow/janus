import { describe, expect, test } from "bun:test";
import { parseWorkspaceRole, resolveGroupId, stableUserId } from "./dev-login";

describe("stableUserId", () => {
	test("two emails with the same 10-character prefix give different ids", async () => {
		const emailA = "alice.johnson@example.com";
		const emailB = "alice.johnsonNOTsame@other.com";
		expect(emailA.slice(0, 10)).toBe(emailB.slice(0, 10));

		const a = await stableUserId(emailA);
		const b = await stableUserId(emailB);
		expect(a).not.toBe(b);
	});

	test("the same email always gives the same id", async () => {
		const a = await stableUserId("dev@localhost");
		const b = await stableUserId("dev@localhost");
		expect(a).toBe(b);
	});

	test("is case- and whitespace-insensitive, like the email lookup", async () => {
		const a = await stableUserId("Dev@Localhost");
		const b = await stableUserId(" dev@localhost ");
		expect(a).toBe(b);
	});
});

describe("parseWorkspaceRole", () => {
	test("accepts a known workspace role", () => {
		expect(parseWorkspaceRole("owner")).toBe("owner");
		expect(parseWorkspaceRole("admin")).toBe("admin");
		expect(parseWorkspaceRole("member")).toBe("member");
	});

	test("rejects an unknown role", () => {
		expect(parseWorkspaceRole("superuser")).toBeNull();
	});
});

describe("resolveGroupId", () => {
	test("'none' clears the group", async () => {
		expect(await resolveGroupId("none")).toBeNull();
		expect(await resolveGroupId("NONE")).toBeNull();
	});

	test("matches a seed key", async () => {
		expect(await resolveGroupId("office")).toBeTypeOf("string");
	});

	test("matches a group name case-insensitively", async () => {
		expect(await resolveGroupId("OFFICE")).toBe(
			(await resolveGroupId("office")) as string,
		);
	});

	test("an unknown group name is undefined", async () => {
		expect(await resolveGroupId("not-a-real-group")).toBeUndefined();
	});
});
