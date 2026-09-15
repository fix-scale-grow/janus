import { describe, expect, test } from "bun:test";
import {
	type AccessPrincipal,
	adminPrincipal,
	noAccessPrincipal,
} from "./access-policy";
import {
	contactScopeWhere,
	dealChildWhere,
	dealScopeWhere,
	isUnscoped,
	requiredDealChildWhere,
} from "./access-scope";

function withScope(scope: AccessPrincipal["scope"]): AccessPrincipal {
	return { ...noAccessPrincipal("me"), groupId: "g", groupName: "G", scope };
}

describe("dealScopeWhere", () => {
	test("admin and ALL are unscoped", () => {
		expect(dealScopeWhere(adminPrincipal("a"))).toEqual({});
		expect(dealScopeWhere(withScope("ALL"))).toEqual({});
		expect(isUnscoped(withScope("ALL"))).toBe(true);
	});

	test("OWN matches owner", () => {
		expect(dealScopeWhere(withScope("OWN"))).toEqual({
			OR: [{ ownerId: "me" }],
		});
	});

	test("ASSIGNED matches nothing before assignments exist", () => {
		expect(dealScopeWhere(withScope("ASSIGNED"))).toEqual({ id: { in: [] } });
	});
});

describe("children", () => {
	test("OWN children include my deal-less records", () => {
		expect(dealChildWhere(withScope("OWN"))).toEqual({
			OR: [
				{ deal: { OR: [{ ownerId: "me" }] } },
				{ dealId: null, createdById: "me" },
			],
		});
	});

	test("ASSIGNED children never include deal-less records", () => {
		expect(dealChildWhere(withScope("ASSIGNED"))).toEqual({
			deal: { id: { in: [] } },
		});
	});

	test("required children", () => {
		expect(requiredDealChildWhere(withScope("OWN"))).toEqual({
			deal: { OR: [{ ownerId: "me" }] },
		});
		expect(requiredDealChildWhere(withScope("ALL"))).toEqual({});
	});
});

describe("contactScopeWhere", () => {
	test("OWN", () => {
		expect(contactScopeWhere(withScope("OWN"))).toEqual({
			OR: [
				{ ownerId: "me" },
				{ deals: { some: { deal: { OR: [{ ownerId: "me" }] } } } },
			],
		});
	});

	test("ASSIGNED", () => {
		expect(contactScopeWhere(withScope("ASSIGNED"))).toEqual({
			deals: { some: { deal: { id: { in: [] } } } },
		});
	});
});
