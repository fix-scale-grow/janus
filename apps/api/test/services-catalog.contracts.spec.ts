import { describe, expect, it } from "bun:test";
import {
	serviceCreateInput,
	serviceListInput,
	serviceUpdateInput,
} from "../src/services-catalog/services-catalog.contracts";

describe("serviceCreateInput", () => {
	it("rejects negative cents", () => {
		const result = serviceCreateInput.safeParse({
			name: "Tear-off",
			unit: "PER_SQUARE",
			unitPriceCents: -100,
		});

		expect(result.success).toBe(false);
	});

	it("accepts a well-formed service", () => {
		const result = serviceCreateInput.safeParse({
			name: "Tear-off",
			unit: "PER_SQUARE",
			unitPriceCents: 8500,
		});

		expect(result.success).toBe(true);
	});
});

describe("serviceUpdateInput", () => {
	it("accepts partial data", () => {
		const result = serviceUpdateInput.safeParse({
			id: "service_1",
			data: { unitPriceCents: 9000 },
		});

		expect(result.success).toBe(true);
	});
});

describe("serviceListInput", () => {
	it("defaults propagate", () => {
		const parsed = serviceListInput.parse({});

		expect(parsed.page).toBe(1);
		expect(parsed.pageSize).toBe(25);
		expect(parsed.trade).toBeUndefined();
		expect(parsed.active).toBeUndefined();
	});
});
