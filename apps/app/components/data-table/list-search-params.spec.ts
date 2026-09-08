import { describe, expect, test } from "bun:test";
import { createListSearchParams } from "./list-search-params";

const config = {
	defaultSort: "createdAt",
	defaultDir: "desc" as const,
	pageSize: 25,
	tabId: "status" as const,
	facetIds: ["owner", "stage"] as const,
};

describe("createListSearchParams with no savedState", () => {
	test("behaves exactly like today: parser defaults come from config", () => {
		const params = createListSearchParams(config);

		expect(params.parsers.sort.defaultValue).toBe("createdAt");
		expect(params.parsers.dir.defaultValue).toBe("desc");
		expect(params.parsers.status.defaultValue).toBe("all");
		expect(params.parsers.owner.defaultValue).toBe("all");
		expect(params.config.pageSize).toBe(25);
	});
});

describe("createListSearchParams with savedState", () => {
	test("absent URL params fall back to the saved defaults", () => {
		const params = createListSearchParams(config, {
			sort: "name",
			dir: "asc",
			tab: "open",
			facets: { owner: "u1" },
			pageSize: 50,
		});

		expect(params.parsers.sort.defaultValue).toBe("name");
		expect(params.parsers.dir.defaultValue).toBe("asc");
		expect(params.parsers.status.defaultValue).toBe("open");
		expect(params.parsers.owner.defaultValue).toBe("u1");
		expect(params.parsers.stage.defaultValue).toBe("all");
		expect(params.config.pageSize).toBe(50);
	});

	test("a present URL param still wins over the saved default (nuqs only applies .withDefault when the URL key is absent)", async () => {
		const params = createListSearchParams(config, {
			sort: "name",
			dir: "asc",
		});

		const values = await params.load(new URLSearchParams({ sort: "amount" }));

		expect(values.sort).toBe("amount");
		expect(values.dir).toBe("asc");
	});

	test("a savedState with only some fields leaves the rest at the factory default", () => {
		const params = createListSearchParams(config, { sort: "name" });

		expect(params.parsers.sort.defaultValue).toBe("name");
		expect(params.parsers.dir.defaultValue).toBe("desc");
		expect(params.parsers.status.defaultValue).toBe("all");
	});

	test("factoryDefaults is unaffected by savedState, for Reset comparisons", () => {
		const params = createListSearchParams(config, {
			sort: "name",
			dir: "asc",
			tab: "open",
			facets: { owner: "u1" },
			pageSize: 50,
		});

		expect(params.factoryDefaults).toEqual({
			sort: "createdAt",
			dir: "desc",
			tab: "all",
			facets: { owner: "all", stage: "all" },
			pageSize: 25,
		});
	});
});
