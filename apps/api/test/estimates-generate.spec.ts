import { describe, expect, it } from "bun:test";
import { buildLineItems } from "../src/estimates/generate";

const svc = (over: object) => ({
	id: "s1",
	name: "Tear-off",
	unit: "PER_SQUARE",
	unitPriceCents: 8500,
	priceGoodCents: null,
	priceBestCents: null,
	symbolId: null,
	...over,
});

describe("buildLineItems", () => {
	it("maps a tagged area shape onto a per-square service", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "a1",
					kind: "area",
					serviceId: "s1",
					label: "Main roof",
					pitch: "6/12",
					symbol: null,
					quantity: { areaSqFt: 14973.4, squares: 149.734 },
				},
			],
			[svc({})],
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.quantity).toBe(149.73);
		expect(items[0]?.priceBetterCents).toBe(8500);
		expect(items[0]?.priceGoodCents).toBe(8500);
		expect(items[0]?.areaLabel).toBe("Main roof");
		expect(items[0]?.scopeId).toBe("a1");
	});

	it("aggregates symbol pins of the same service into one counted line", () => {
		const pin = (id: string) => ({
			scopeId: id,
			kind: "pin" as const,
			serviceId: null,
			label: null,
			pitch: null,
			symbol: "janus-roofing-roof-vent",
			quantity: { count: 1 },
		});
		const items = buildLineItems(
			[pin("p1"), pin("p2"), pin("p3")],
			[
				svc({
					id: "s9",
					name: "Roof vent",
					unit: "PER_EACH",
					unitPriceCents: 7500,
					symbolId: "janus-roofing-roof-vent",
				}),
			],
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.quantity).toBe(3);
		expect(items[0]?.scopeId).toBeNull();
	});

	it("keeps its own line when a shape has both serviceId and symbol set", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "p1",
					kind: "pin",
					serviceId: "s9",
					label: null,
					pitch: null,
					symbol: "janus-roofing-roof-vent",
					quantity: { count: 1 },
				},
			],
			[
				svc({
					id: "s9",
					name: "Roof vent",
					unit: "PER_EACH",
					unitPriceCents: 7500,
					symbolId: "janus-roofing-roof-vent",
				}),
			],
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.quantity).toBe(1);
		expect(items[0]?.scopeId).toBe("p1");
	});

	it("uses good/best variants when the service has them", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "a1",
					kind: "area",
					serviceId: "s1",
					label: null,
					pitch: null,
					symbol: null,
					quantity: { areaSqFt: 1000, squares: 10 },
				},
			],
			[svc({ priceGoodCents: 7500, priceBestCents: 9500 })],
		);
		expect(items[0]?.priceGoodCents).toBe(7500);
		expect(items[0]?.priceBestCents).toBe(9500);
	});

	it("resolves a symbol DB id through the symbols table first", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "p1",
					kind: "pin",
					serviceId: null,
					label: null,
					pitch: null,
					symbol: "sym_roof_vent",
					quantity: { count: 1 },
				},
			],
			[
				svc({
					id: "s9",
					name: "Roof vent",
					unit: "PER_EACH",
					unitPriceCents: 7500,
					symbolId: null,
				}),
			],
			[{ id: "sym_roof_vent", serviceId: "s9" }],
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.serviceId).toBe("s9");
		expect(items[0]?.quantity).toBe(1);
	});

	it("still resolves the legacy Service.symbolId path when no symbols table match exists", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "p1",
					kind: "pin",
					serviceId: null,
					label: null,
					pitch: null,
					symbol: "janus-roofing-roof-vent",
					quantity: { count: 1 },
				},
			],
			[
				svc({
					id: "s9",
					name: "Roof vent",
					unit: "PER_EACH",
					unitPriceCents: 7500,
					symbolId: "janus-roofing-roof-vent",
				}),
			],
			[{ id: "sym_other", serviceId: "s1" }],
		);
		expect(items).toHaveLength(1);
		expect(items[0]?.serviceId).toBe("s9");
	});

	it("skips untagged shapes and unit mismatches", () => {
		const items = buildLineItems(
			[
				{
					scopeId: "x",
					kind: "line",
					serviceId: null,
					label: null,
					pitch: null,
					symbol: null,
					quantity: { lengthFt: 50 },
				},
				{
					scopeId: "y",
					kind: "line",
					serviceId: "s1",
					label: null,
					pitch: null,
					symbol: null,
					quantity: { lengthFt: 50 },
				},
			],
			[svc({})],
		);
		expect(items).toHaveLength(0);
	});
});
