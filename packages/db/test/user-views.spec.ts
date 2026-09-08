import { describe, expect, it } from "bun:test";
import { parseViewState, viewTableId } from "../src/user-views";

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
