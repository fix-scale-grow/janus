import { expect, test } from "bun:test";
import { DEFAULT_LAYOUT } from "./layout";
import { DASHBOARD_WIDGETS, visibleWidgets } from "./widget-registry";

test("every default layout id exists in the registry", () => {
	const ids = new Set(DASHBOARD_WIDGETS.map((w) => w.id));
	for (const entry of DEFAULT_LAYOUT) expect(ids.has(entry.id)).toBe(true);
});

test("profit widgets are hidden without the permission", () => {
	const ids = visibleWidgets(DASHBOARD_WIDGETS, []).map((w) => w.id);
	expect(ids).not.toContain("profit-by-month");
	expect(ids).not.toContain("costs-by-category");
	expect(ids).toContain("trend");
});

test("profit widgets show with the permission", () => {
	const ids = visibleWidgets(DASHBOARD_WIDGETS, ["profit.view"]).map(
		(w) => w.id,
	);
	expect(ids).toContain("profit-by-month");
});
