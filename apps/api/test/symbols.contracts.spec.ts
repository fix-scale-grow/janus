import { describe, expect, it } from "bun:test";
import {
	symbolCreateInput,
	symbolListInput,
	symbolUpdateInput,
} from "../src/symbols/symbols.contracts";

const el = (id: string) => ({ id, type: "rectangle", x: 0, y: 0 });

describe("symbolCreateInput", () => {
	it("rejects an empty elements array", () => {
		const result = symbolCreateInput.safeParse({
			name: "Roof vent",
			elements: [],
		});

		expect(result.success).toBe(false);
	});

	it("rejects more than 50 elements", () => {
		const result = symbolCreateInput.safeParse({
			name: "Roof vent",
			elements: Array.from({ length: 51 }, (_, i) => el(`el-${i}`)),
		});

		expect(result.success).toBe(false);
	});

	it("rejects a negative width", () => {
		const result = symbolCreateInput.safeParse({
			name: "Roof vent",
			elements: [el("el-1")],
			widthFt: -1,
		});

		expect(result.success).toBe(false);
	});

	it("rejects a negative height", () => {
		const result = symbolCreateInput.safeParse({
			name: "Roof vent",
			elements: [el("el-1")],
			heightFt: -1,
		});

		expect(result.success).toBe(false);
	});

	it("accepts a well-formed symbol", () => {
		const result = symbolCreateInput.safeParse({
			name: "Roof vent",
			elements: [el("el-1")],
			widthFt: 1,
			heightFt: 1,
		});

		expect(result.success).toBe(true);
	});

	it("rejects a symbol whose payload exceeds the byte cap", () => {
		const result = symbolCreateInput.safeParse({
			name: "Roof vent",
			elements: [{ ...el("el-1"), customData: { blob: "x".repeat(600_000) } }],
		});

		expect(result.success).toBe(false);
	});
});

describe("symbolUpdateInput", () => {
	it("accepts partial data", () => {
		const result = symbolUpdateInput.safeParse({
			id: "symbol_1",
			data: { active: false },
		});

		expect(result.success).toBe(true);
	});
});

describe("symbolListInput", () => {
	it("defaults propagate", () => {
		const parsed = symbolListInput.parse({});

		expect(parsed.page).toBe(1);
		expect(parsed.pageSize).toBe(25);
		expect(parsed.trade).toBeUndefined();
		expect(parsed.active).toBeUndefined();
	});
});
