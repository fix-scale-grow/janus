import { describe, expect, test } from "bun:test";
import { composeStickyFacets, decideStickySave } from "./table-query";

describe("composeStickyFacets", () => {
	test("drops the tab id key, keeping only the real facets", () => {
		expect(
			composeStickyFacets({ status: "open", owner: "u1" }, "status"),
		).toEqual({ owner: "u1" });
	});

	test("returns the filters unchanged when the table has no tab", () => {
		expect(composeStickyFacets({ owner: "u1" })).toEqual({ owner: "u1" });
	});

	test("factory state on a tab-bearing table matches its viewDefaults shape", () => {
		const currentView = {
			sort: "createdAt",
			dir: "desc",
			tab: "all",
			facets: composeStickyFacets({ status: "all", owner: "all" }, "status"),
			hiddenColumns: [] as string[],
			pageSize: 25,
		};
		const viewDefaults = {
			sort: "createdAt",
			dir: "desc",
			tab: "all",
			facets: { owner: "all" },
			hiddenColumns: [] as string[],
			pageSize: 25,
		};

		expect(JSON.stringify(currentView) !== JSON.stringify(viewDefaults)).toBe(
			false,
		);
	});
});

describe("decideStickySave", () => {
	test("a second render with no sticky change does not schedule a save", () => {
		const serialized = JSON.stringify({ sort: "name" });
		const first = decideStickySave({
			serialized,
			mounted: false,
			resetting: false,
			lastPersisted: null,
		});
		expect(first.action).toBe("seed");

		const second = decideStickySave({
			serialized,
			mounted: true,
			resetting: false,
			lastPersisted: serialized,
		});
		expect(second.action).toBe("skip");
	});

	test("a deep-link visit never persists the URL's values, even after re-renders", () => {
		const deepLinkSerialized = JSON.stringify({ sort: "amount" });
		const seed = decideStickySave({
			serialized: deepLinkSerialized,
			mounted: false,
			resetting: false,
			lastPersisted: null,
		});
		expect(seed.action).toBe("seed");
		if (seed.action !== "seed") throw new Error("unreachable");

		const rerender = decideStickySave({
			serialized: deepLinkSerialized,
			mounted: true,
			resetting: false,
			lastPersisted: seed.serialized,
		});
		expect(rerender.action).toBe("skip");
	});

	test("a genuine sticky-field change schedules a save", () => {
		const previous = JSON.stringify({ sort: "name" });
		const changed = JSON.stringify({ sort: "createdAt" });
		const decision = decideStickySave({
			serialized: changed,
			mounted: true,
			resetting: false,
			lastPersisted: previous,
		});
		expect(decision.action).toBe("schedule");
	});

	test("suppresses saves while a reset is settling, then settles once the state converges", () => {
		const factorySerialized = JSON.stringify({ sort: "createdAt" });
		const transient = decideStickySave({
			serialized: JSON.stringify({ sort: "name" }),
			mounted: true,
			resetting: true,
			lastPersisted: factorySerialized,
		});
		expect(transient.action).toBe("skip");

		const converged = decideStickySave({
			serialized: factorySerialized,
			mounted: true,
			resetting: true,
			lastPersisted: factorySerialized,
		});
		expect(converged.action).toBe("settle");
	});
});
