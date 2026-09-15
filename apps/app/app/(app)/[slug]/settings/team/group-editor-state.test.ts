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
	policy: parseAccessPolicy(office.policy, "Office"),
};

describe("groupEditorReducer", () => {
	test("field surface moves ALL scope to ASSIGNED", () => {
		expect(
			groupEditorReducer(base, { type: "setSurface", surface: "FIELD" }).scope,
		).toBe("ASSIGNED");
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
