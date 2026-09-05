import { describe, expect, it } from "bun:test";
import {
	drawingListInput,
	drawingRenameInput,
	drawingSaveSceneInput,
} from "../src/drawings/drawings.contracts";

describe("drawingSaveSceneInput", () => {
	it("rejects a scene missing excalidraw", () => {
		const result = drawingSaveSceneInput.safeParse({
			id: "drawing_1",
			scene: { satellite: null },
		});

		expect(result.success).toBe(false);
	});

	it("accepts a well-formed scene", () => {
		const result = drawingSaveSceneInput.safeParse({
			id: "drawing_1",
			scene: {
				excalidraw: { elements: [], appState: {}, files: {} },
				satellite: null,
			},
		});

		expect(result.success).toBe(true);
	});
});

describe("drawingRenameInput", () => {
	it("rejects an empty title", () => {
		const result = drawingRenameInput.safeParse({ id: "drawing_1", title: "" });

		expect(result.success).toBe(false);
	});
});

describe("drawingListInput", () => {
	it("defaults attachment to all", () => {
		const parsed = drawingListInput.parse({});

		expect(parsed.attachment).toBe("all");
	});
});
