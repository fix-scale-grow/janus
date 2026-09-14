import { describe, expect, it } from "bun:test";
import { BOARD_PAGE_SIZE, boardListInput } from "./board-list-input";

describe("boardListInput", () => {
	it("neutralizes every filter the board cannot display", () => {
		const result = boardListInput({
			q: "roof",
			status: "open",
			owner: "user-1",
			stage: "stage_seed_qualified_to_buy",
			closing: "this-month",
			pipeline: "pipe-1",
			sort: "createdAt",
			dir: "desc" as const,
			page: 3,
			pageSize: 25,
		});

		expect(result.q).toBe("");
		expect(result.status).toBe("all");
		expect(result.owner).toBe("all");
		expect(result.stage).toBe("all");
		expect(result.closing).toBe("all");
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(BOARD_PAGE_SIZE);
	});

	it("keeps the filters the board does display", () => {
		const result = boardListInput({
			q: "",
			status: "all",
			owner: "all",
			stage: "all",
			closing: "all",
			pipeline: "pipe-2",
			sort: "amount",
			dir: "asc" as const,
			page: 1,
			pageSize: 25,
		});

		expect(result.pipeline).toBe("pipe-2");
		expect(result.sort).toBe("amount");
		expect(result.dir).toBe("asc");
	});
});
