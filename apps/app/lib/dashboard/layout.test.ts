import { expect, test } from "bun:test";
import { DASHBOARD } from "./dashboard-config";
import { addEntry, DEFAULT_LAYOUT, resolveLayout } from "./layout";

const META = [
	{ id: "trend", title: "T", minW: 16, minH: 24, defaultW: 28, defaultH: 40 },
	{
		id: "activity",
		title: "A",
		minW: 16,
		minH: 20,
		defaultW: 48,
		defaultH: 32,
	},
];

test("undefined saved layout resolves to the default", () => {
	const metas = DEFAULT_LAYOUT.map((e) => ({
		id: e.id,
		title: e.id,
		minW: 1,
		minH: 1,
		defaultW: e.w,
		defaultH: e.h,
	}));
	expect(resolveLayout(undefined, metas)).toEqual(DEFAULT_LAYOUT);
});

test("unknown widget ids are dropped", () => {
	const saved = [
		{ id: "trend", x: 0, y: 0, w: 20, h: 30 },
		{ id: "gone-widget", x: 20, y: 0, w: 10, h: 10 },
	];
	expect(resolveLayout(saved, META).map((e) => e.id)).toEqual(["trend"]);
});

test("sizes clamp to min and grid bounds", () => {
	const saved = [{ id: "trend", x: 40, y: 0, w: 4, h: 4 }];
	const [e] = resolveLayout(saved, META);
	if (!e) throw new Error("expected a resolved layout entry");
	expect(e.w).toBe(16);
	expect(e.h).toBe(24);
	expect(e.x + e.w).toBeLessThanOrEqual(DASHBOARD.grid.cols);
});

test("a saved layout of only unknown ids falls back to the default", () => {
	const saved = [{ id: "gone", x: 0, y: 0, w: 10, h: 10 }];
	expect(resolveLayout(saved, META).length).toBeGreaterThan(0);
});

test("addEntry lands below everything", () => {
	const layout = [{ id: "trend", x: 0, y: 5, w: 20, h: 30 }];
	const activityMeta = META[1];
	if (!activityMeta) throw new Error("expected activity meta");
	const next = addEntry(layout, activityMeta);
	expect(next.at(-1)).toEqual({ id: "activity", x: 0, y: 35, w: 48, h: 32 });
});
