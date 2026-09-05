import { describe, expect, it } from "bun:test";
import { emptyScene, parseDrawingScale, parseDrawingScene } from "../src/index";

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
