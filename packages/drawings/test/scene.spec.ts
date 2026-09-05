import { describe, expect, it } from "bun:test";
import {
	DRAWINGS,
	emptyScene,
	isSceneTooLarge,
	parseDrawingScale,
	parseDrawingScene,
	parseServiceModifier,
	promoteSymbolPinCustomData,
	sceneByteLength,
	serviceModifier,
} from "../src/index";

describe("parseDrawingScene", () => {
	it("round-trips an empty scene", () => {
		const scene = parseDrawingScene(emptyScene());
		expect(scene.excalidraw.elements).toEqual([]);
		expect(scene.satellite).toBeNull();
	});

	it("rejects a scene with no excalidraw slot", () => {
		expect(() => parseDrawingScene({ satellite: null })).toThrow();
	});

	it("preserves unknown excalidraw element fields", () => {
		const scene = parseDrawingScene({
			excalidraw: {
				elements: [
					{
						id: "a",
						type: "freedraw",
						x: 1,
						y: 2,
						strokeColor: "#000",
						pressures: [0.5],
					},
				],
				appState: {},
				files: {},
			},
			satellite: null,
		});
		expect(
			(scene.excalidraw.elements[0] as Record<string, unknown>).strokeColor,
		).toBe("#000");
	});
});

describe("isSceneTooLarge", () => {
	it("allows an empty scene", () => {
		expect(isSceneTooLarge(emptyScene())).toBe(false);
	});

	it("counts UTF-8 bytes, not characters", () => {
		const scene = { note: "☃".repeat(3) };
		expect(sceneByteLength(scene)).toBeGreaterThan(
			JSON.stringify(scene).length,
		);
	});

	it("rejects a scene past the byte limit", () => {
		const scene = { note: "a".repeat(DRAWINGS.limits.maxSceneBytes) };
		expect(isSceneTooLarge(scene)).toBe(true);
	});
});

describe("parseDrawingScale", () => {
	it("returns null for null", () => {
		expect(parseDrawingScale(null)).toBeNull();
	});

	it("rejects a zero scale", () => {
		expect(() =>
			parseDrawingScale({ pixelsPerFoot: 0, referenceElementId: null }),
		).toThrow();
	});

});

describe("serviceModifier", () => {
	it("parses a pitch-shaped modifier", () => {
		const modifier = parseServiceModifier({
			label: "Pitch",
			options: [
				{ name: "flat", factor: 1 },
				{ name: "6/12", factor: 1.118 },
			],
		});
		expect(modifier?.label).toBe("Pitch");
		expect(modifier?.options).toHaveLength(2);
	});

	it("returns null for null", () => {
		expect(parseServiceModifier(null)).toBeNull();
	});

	it("rejects an option with a non-positive factor", () => {
		expect(() =>
			serviceModifier.parse({
				label: "Pitch",
				options: [{ name: "flat", factor: 0 }],
			}),
		).toThrow();
	});

	it("rejects an empty options list", () => {
		expect(() =>
			serviceModifier.parse({ label: "Pitch", options: [] }),
		).toThrow();
	});
});

describe("promoteSymbolPinCustomData", () => {
	it("promotes a linear symbol pin to a line-kind scope, keeping linear", () => {
		const scope = promoteSymbolPinCustomData(
			{ symbol: "sym_gutter_run", linear: true },
			"el-1",
		);
		expect(scope.kind).toBe("line");
		expect(scope.symbol).toBe("sym_gutter_run");
		expect(scope.linear).toBe(true);
	});

	it("promotes a non-linear symbol pin to a pin-kind scope, without linear", () => {
		const scope = promoteSymbolPinCustomData(
			{ symbol: "sym_roof_vent" },
			"el-2",
		);
		expect(scope.kind).toBe("pin");
		expect(scope.symbol).toBe("sym_roof_vent");
		expect(scope.linear).toBeUndefined();
	});
});
