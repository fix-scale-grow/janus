import { describe, expect, it } from "bun:test";
import {
	DASHBOARD_LAYOUT_MAX,
	dashboardLayoutEntry,
	parseViewState,
	viewTableId,
} from "../src/user-views";

describe("parseViewState", () => {
	it("accepts every documented field", () => {
		const state = parseViewState({
			sort: "createdAt",
			dir: "desc",
			tab: "open",
			facets: { owner: "u1", stage: "closed" },
			hiddenColumns: ["createdAt"],
			pageSize: 50,
			density: "compact",
		});

		expect(state).toEqual({
			sort: "createdAt",
			dir: "desc",
			tab: "open",
			facets: { owner: "u1", stage: "closed" },
			hiddenColumns: ["createdAt"],
			pageSize: 50,
			density: "compact",
		});
	});

	it("treats every field as optional", () => {
		expect(parseViewState({})).toEqual({});
	});

	it("strips unknown keys", () => {
		const state = parseViewState({ sort: "name", evil: "dropTable" });
		expect(state).toEqual({ sort: "name" });
		expect("evil" in state).toBe(false);
	});

	it("rejects a bad direction", () => {
		expect(() => parseViewState({ dir: "sideways" })).toThrow();
	});

	it("rejects a non-positive pageSize", () => {
		expect(() => parseViewState({ pageSize: 0 })).toThrow();
	});
});

describe("viewTableId", () => {
	it("accepts the eight known table ids", () => {
		expect(viewTableId.parse("deals")).toBe("deals");
		expect(viewTableId.parse("production-board")).toBe("production-board");
	});

	it("rejects an unknown table id", () => {
		expect(() => viewTableId.parse("nope")).toThrow();
	});
});

describe("dashboardLayout", () => {
	it("dashboard is a valid table id", () => {
		expect(viewTableId.parse("dashboard")).toBe("dashboard");
	});

	it("dashboardLayout round-trips through parseViewState", () => {
		const state = {
			dashboardLayout: [{ id: "trend", x: 0, y: 13, w: 28, h: 40 }],
		};
		expect(parseViewState(state)).toEqual(state);
	});

	it("dashboardLayout rejects out-of-range entries", () => {
		expect(() =>
			parseViewState({
				dashboardLayout: [{ id: "trend", x: 48, y: 0, w: 1, h: 1 }],
			}),
		).toThrow();
		expect(() =>
			parseViewState({
				dashboardLayout: [{ id: "trend", x: 0, y: 0, w: 49, h: 1 }],
			}),
		).toThrow();
	});

	it("DASHBOARD_LAYOUT_MAX matches the schema maxima", () => {
		expect(DASHBOARD_LAYOUT_MAX.y).toBe(500);
		expect(DASHBOARD_LAYOUT_MAX.h).toBe(120);
		expect(() =>
			dashboardLayoutEntry.parse({
				id: "trend",
				x: 0,
				y: DASHBOARD_LAYOUT_MAX.y,
				w: 1,
				h: DASHBOARD_LAYOUT_MAX.h,
			}),
		).not.toThrow();
		expect(() =>
			dashboardLayoutEntry.parse({
				id: "trend",
				x: 0,
				y: DASHBOARD_LAYOUT_MAX.y + 1,
				w: 1,
				h: 1,
			}),
		).toThrow();
		expect(() =>
			dashboardLayoutEntry.parse({
				id: "trend",
				x: 0,
				y: 0,
				w: 1,
				h: DASHBOARD_LAYOUT_MAX.h + 1,
			}),
		).toThrow();
	});
});
