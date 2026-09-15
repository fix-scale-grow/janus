import { describe, expect, test } from "bun:test";
import { ACCESS } from "@crm/db/access-config";
import { parseAccessPolicy } from "@crm/db/access-policy";
import {
	EDITOR_ACTIONS,
	type GroupDraft,
	groupEditorReducer,
} from "./group-editor-state";

const office = ACCESS.seedGroups.find((g) => g.key === "office");
if (!office) throw new Error("office seed missing");
const base: GroupDraft = {
	id: "g",
	name: "Office",
	surface: "FULL",
	scope: "ALL",
	scopeBeforeField: null,
	policy: parseAccessPolicy(office.policy, "Office"),
};

describe("groupEditorReducer", () => {
	test("field surface moves ALL scope to ASSIGNED", () => {
		expect(
			groupEditorReducer(base, { type: "setSurface", surface: "FIELD" }).scope,
		).toBe("ASSIGNED");
	});

	test("switching back to full app restores the scope field mode replaced", () => {
		const field = groupEditorReducer(base, {
			type: "setSurface",
			surface: "FIELD",
		});
		const full = groupEditorReducer(field, {
			type: "setSurface",
			surface: "FULL",
		});
		expect(full.scope).toBe("ALL");
		expect(full.scopeBeforeField).toBeNull();
	});

	test("field mode keeps All records when the user picks it", () => {
		const field = groupEditorReducer(base, {
			type: "setSurface",
			surface: "FIELD",
		});
		const picked = groupEditorReducer(field, {
			type: "setScope",
			scope: "ALL",
		});
		expect(picked.surface).toBe("FIELD");
		expect(picked.scope).toBe("ALL");
		expect(picked.scopeBeforeField).toBeNull();
	});

	test("a scope picked in field mode survives the switch back", () => {
		const field = groupEditorReducer(base, {
			type: "setSurface",
			surface: "FIELD",
		});
		const own = groupEditorReducer(field, { type: "setScope", scope: "OWN" });
		expect(
			groupEditorReducer(own, { type: "setSurface", surface: "FULL" }).scope,
		).toBe("OWN");
	});

	test("reports clamp to VIEW", () => {
		expect(
			groupEditorReducer(base, {
				type: "setLevel",
				area: "reports",
				level: "DELETE",
			}).policy.areas.reports,
		).toBe("VIEW");
	});

	test("toggle money", () => {
		const next = groupEditorReducer(base, {
			type: "toggleMoney",
			money: "profit",
		});
		expect(next.policy.money).toContain("profit");
		expect(
			groupEditorReducer(next, { type: "toggleMoney", money: "profit" }).policy
				.money,
		).not.toContain("profit");
	});

	test("toggle action", () => {
		expect(
			groupEditorReducer(base, {
				type: "toggleAction",
				action: "jobCosts.submit",
			}).policy.actions,
		).toEqual(["jobCosts.submit"]);
	});
});

describe("editor actions", () => {
	test("sign on site stays hidden until in-person signing exists", () => {
		expect(EDITOR_ACTIONS).not.toContain("contracts.signInPerson");
		expect(EDITOR_ACTIONS).toEqual(["jobCosts.submit", "deals.markComplete"]);
		expect(ACCESS.actions).toContain("contracts.signInPerson");
	});
});
