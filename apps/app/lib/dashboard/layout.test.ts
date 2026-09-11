import { expect, test } from "bun:test";
import { DASHBOARD } from "./dashboard-config";
import {
	addEntry,
	DEFAULT_LAYOUT,
	resolveLayout,
	upgradeLayout,
} from "./layout";

const META = [
	{ id: "trend", title: "T", minW: 4, minH: 6, defaultW: 7, defaultH: 10 },
	{
		id: "activity",
		title: "A",
		minW: 4,
		minH: 5,
		defaultW: 12,
		defaultH: 8,
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
		{ id: "trend", x: 0, y: 0, w: 7, h: 10 },
		{ id: "gone-widget", x: 7, y: 0, w: 5, h: 10 },
	];
	expect(resolveLayout(saved, META, 2).map((e) => e.id)).toEqual(["trend"]);
});

test("sizes clamp to min and grid bounds", () => {
	const saved = [{ id: "trend", x: 10, y: 0, w: 1, h: 1 }];
	const [e] = resolveLayout(saved, META, 2);
	if (!e) throw new Error("expected a resolved layout entry");
	expect(e.w).toBe(4);
	expect(e.h).toBe(6);
	expect(e.x + e.w).toBeLessThanOrEqual(DASHBOARD.grid.cols);
});

test("a saved layout of only unknown ids falls back to the default", () => {
	const saved = [{ id: "gone", x: 0, y: 0, w: 10, h: 10 }];
	expect(resolveLayout(saved, META, 2).length).toBeGreaterThan(0);
});

test("addEntry lands below everything", () => {
	const layout = [{ id: "trend", x: 0, y: 5, w: 7, h: 10 }];
	const activityMeta = META[1];
	if (!activityMeta) throw new Error("expected activity meta");
	const next = addEntry(layout, activityMeta);
	expect(next.at(-1)).toEqual({ id: "activity", x: 0, y: 15, w: 12, h: 8 });
});

test("upgradeLayout leaves version-2 layouts unscaled", () => {
	const saved = [{ id: "trend", x: 3, y: 6, w: 7, h: 10 }];
	expect(upgradeLayout(saved, 2)).toEqual(saved);
});

test("upgradeLayout rescales a legacy 48-col layout by dividing by 4", () => {
	const saved = [{ id: "trend", x: 8, y: 16, w: 28, h: 40 }];
	expect(upgradeLayout(saved, undefined)).toEqual([
		{ id: "trend", x: 2, y: 4, w: 7, h: 10 },
	]);
});

test("upgradeLayout rescales and rounds an odd legacy layout", () => {
	const saved = [{ id: "trend", x: 1, y: 1, w: 5, h: 5 }];
	expect(upgradeLayout(saved, undefined)).toEqual([
		{ id: "trend", x: 0, y: 0, w: 1, h: 1 },
	]);
});

test("resolveLayout rescales a legacy saved layout and clamps into 12-col bounds", () => {
	const saved = [{ id: "trend", x: 40, y: 0, w: 28, h: 40 }];
	const [e] = resolveLayout(saved, META, undefined);
	if (!e) throw new Error("expected a resolved layout entry");
	expect(e.w).toBe(7);
	expect(e.h).toBe(10);
	expect(e.x + e.w).toBeLessThanOrEqual(DASHBOARD.grid.cols);
});

test("resolveLayout leaves a version-2 saved layout unscaled", () => {
	const saved = [{ id: "trend", x: 0, y: 3, w: 7, h: 10 }];
	expect(resolveLayout(saved, META, 2)).toEqual(saved);
});
