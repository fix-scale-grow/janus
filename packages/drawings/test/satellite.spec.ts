import { describe, expect, it } from "bun:test";
import { measureSatellite, PITCH_FACTORS } from "../src/index";

describe("measureSatellite", () => {
	it("applies pitch to a measured roof area", () => {
		const shapes = measureSatellite([
			{
				id: "f1",
				kind: "area",
				coordinates: [
					[-86.8, 33.5],
					[-86.79, 33.5],
					[-86.79, 33.51],
				],
				measured: { areaSqFt: 2000 },
				scope: {
					scopeId: "f1",
					kind: "area",
					serviceId: null,
					label: "Main roof",
					pitch: "8/12",
				},
			},
		]);
		const q = shapes[0]?.quantity;
		expect(q && "areaSqFt" in q ? q.areaSqFt : 0).toBeCloseTo(
			2000 * PITCH_FACTORS["8/12"],
		);
	});
});
