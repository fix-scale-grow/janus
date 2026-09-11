import { expect, test } from "bun:test";
import { DEFAULT_LAYOUT, resolveLayout } from "./layout";
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

test("pipelineBoardMeta builds an instance meta", async () => {
	const { pipelineBoardMeta } = await import("./widget-registry-meta");
	const meta = pipelineBoardMeta({ id: "p1", name: "Sales" });
	expect(meta.id).toBe("pipeline-board:p1");
	expect(meta.title).toBe("Sales — mini board");
	expect(meta.minW).toBe(20);
	expect(meta.defaultH).toBe(34);
});

test("resolveLayout keeps a board whose meta exists and drops one whose meta is gone", async () => {
	const { pipelineBoardMeta } = await import("./widget-registry-meta");
	const metas = [pipelineBoardMeta({ id: "p1", name: "Sales" })];
	const saved = [
		{ id: "pipeline-board:p1", x: 0, y: 0, w: 24, h: 34 },
		{ id: "pipeline-board:gone", x: 24, y: 0, w: 24, h: 34 },
	];
	expect(resolveLayout(saved, metas).map((e) => e.id)).toEqual(["pipeline-board:p1"]);
});
