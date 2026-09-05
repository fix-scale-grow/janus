import { describe, expect, it } from "bun:test";
import {
	measureScene,
	PITCH_FACTORS,
	polygonAreaSqFt,
	polylineLengthFt,
} from "../src/index";

describe("polygonAreaSqFt", () => {
	it("measures a 100x50 px rectangle at 10 px/ft as 50 sqft", () => {
		const points: [number, number][] = [
			[0, 0],
			[100, 0],
			[100, 50],
			[0, 50],
		];
		expect(polygonAreaSqFt(points, 10)).toBeCloseTo(50);
	});

	it("is orientation independent", () => {
		const cw: [number, number][] = [
			[0, 0],
			[0, 50],
			[100, 50],
			[100, 0],
		];
		expect(polygonAreaSqFt(cw, 10)).toBeCloseTo(50);
	});
});

describe("polylineLengthFt", () => {
	it("measures a 3-4-5 triangle path", () => {
		const points: [number, number][] = [
			[0, 0],
			[30, 0],
			[30, 40],
		];
		expect(polylineLengthFt(points, 10)).toBeCloseTo(7);
	});
});

describe("measureScene", () => {
	it("returns null quantity when scale is missing", () => {
		const scene = {
			excalidraw: {
				elements: [
					{
						id: "r1",
						type: "rectangle",
						x: 0,
						y: 0,
						width: 100,
						height: 50,
						angle: 0,
						isDeleted: false,
						customData: { scopeId: "s1", kind: "area" },
					},
				],
				appState: {},
				files: {},
			},
			satellite: null,
		};
		const measured = measureScene(scene as never, null);
		expect(measured).toHaveLength(1);
		expect(measured[0]?.quantity).toBeNull();
	});

	it("applies pitch factor to area shapes", () => {
		const scene = {
			excalidraw: {
				elements: [
					{
						id: "r1",
						type: "rectangle",
						x: 0,
						y: 0,
						width: 1000,
						height: 1000,
						angle: 0,
						isDeleted: false,
						customData: { scopeId: "s1", kind: "area", pitch: "6/12" },
					},
				],
				appState: {},
				files: {},
			},
			satellite: null,
		};
		const measured = measureScene(scene as never, {
			pixelsPerFoot: 10,
			referenceElementId: null,
		});
		const q = measured[0]?.quantity;
		expect(q && "areaSqFt" in q ? q.areaSqFt : 0).toBeCloseTo(
			10000 * PITCH_FACTORS["6/12"],
		);
	});

	it("counts pins per service", () => {
		const pin = (id: string) => ({
			id,
			type: "ellipse",
			x: 0,
			y: 0,
			width: 24,
			height: 24,
			angle: 0,
			isDeleted: false,
			customData: { scopeId: id, kind: "pin", serviceId: "vent" },
		});
		const scene = {
			excalidraw: {
				elements: [pin("p1"), pin("p2")],
				appState: {},
				files: {},
			},
			satellite: null,
		};
		const measured = measureScene(scene as never, null);
		expect(measured).toHaveLength(2);
		expect(measured[0]?.quantity).toEqual({ count: 1 });
	});

	describe("symbol pins", () => {
		it("treats a placed library symbol as a pin keyed by element id", () => {
			const scene = {
				excalidraw: {
					elements: [
						{
							id: "el-1",
							type: "ellipse",
							x: 0,
							y: 0,
							width: 40,
							height: 40,
							isDeleted: false,
							customData: { symbol: "janus-roofing-roof-vent" },
						},
						{
							id: "el-2",
							type: "ellipse",
							x: 90,
							y: 0,
							width: 40,
							height: 40,
							isDeleted: false,
							customData: { symbol: "janus-roofing-roof-vent" },
						},
					],
					appState: {},
					files: {},
				},
				satellite: null,
			};
			const measured = measureScene(scene as never, null);
			expect(measured).toHaveLength(2);
			expect(measured[0]?.kind).toBe("pin");
			expect(measured[0]?.scopeId).toBe("el-1");
			expect(measured[0]?.symbol).toBe("janus-roofing-roof-vent");
			expect(measured[0]?.quantity).toEqual({ count: 1 });
		});

		it("measures a linear symbol as a length when a scale is set", () => {
			const scene = {
				excalidraw: {
					elements: [
						{
							id: "gutter-1",
							type: "line",
							x: 0,
							y: 0,
							width: 100,
							height: 0,
							isDeleted: false,
							customData: { symbol: "sym_gutter_run", linear: true },
						},
					],
					appState: {},
					files: {},
				},
				satellite: null,
			};
			const measured = measureScene(scene as never, {
				pixelsPerFoot: 10,
				referenceElementId: null,
			});
			expect(measured).toHaveLength(1);
			expect(measured[0]?.kind).toBe("line");
			expect(measured[0]?.symbol).toBe("sym_gutter_run");
			expect(measured[0]?.quantity).toEqual({ lengthFt: 10 });
		});

		it("returns a null quantity for a linear symbol with no scale set", () => {
			const scene = {
				excalidraw: {
					elements: [
						{
							id: "gutter-1",
							type: "line",
							x: 0,
							y: 0,
							width: 100,
							height: 0,
							isDeleted: false,
							customData: { symbol: "sym_gutter_run", linear: true },
						},
					],
					appState: {},
					files: {},
				},
				satellite: null,
			};
			const measured = measureScene(scene as never, null);
			expect(measured).toHaveLength(1);
			expect(measured[0]?.kind).toBe("line");
			expect(measured[0]?.quantity).toBeNull();
		});

		it("leaves a non-linear symbol pin unchanged", () => {
			const scene = {
				excalidraw: {
					elements: [
						{
							id: "vent-1",
							type: "ellipse",
							x: 0,
							y: 0,
							width: 40,
							height: 40,
							isDeleted: false,
							customData: { symbol: "sym_roof_vent" },
						},
					],
					appState: {},
					files: {},
				},
				satellite: null,
			};
			const measured = measureScene(scene as never, {
				pixelsPerFoot: 10,
				referenceElementId: null,
			});
			expect(measured).toHaveLength(1);
			expect(measured[0]?.kind).toBe("pin");
			expect(measured[0]?.quantity).toEqual({ count: 1 });
		});
	});
});
