import { describe, expect, it } from "bun:test";
import {
	excalidrawToolFor,
	hintFor,
	initialDraftState,
	isMarkingMode,
	mixTowardWhite,
	modeForExcalidrawTool,
	nextDraft,
	parseHexColor,
	parseRgbString,
} from "./toolbar-modes";

describe("excalidrawToolFor", () => {
	it("maps marking modes onto the line tool", () => {
		expect(excalidrawToolFor("area")).toBe("line");
		expect(excalidrawToolFor("line")).toBe("line");
	});

	it("maps pointer modes onto the selection tool", () => {
		expect(excalidrawToolFor("pin")).toBe("selection");
		expect(excalidrawToolFor("scale")).toBe("selection");
		expect(excalidrawToolFor("select")).toBe("selection");
	});
});

describe("modeForExcalidrawTool", () => {
	it("maps native tools back to modes", () => {
		expect(modeForExcalidrawTool("selection")).toBe("select");
		expect(modeForExcalidrawTool("freedraw")).toBe("freedraw");
	});

	it("returns null for tools without a toolbar mode", () => {
		expect(modeForExcalidrawTool("eraser")).toBeNull();
		expect(modeForExcalidrawTool("laser")).toBeNull();
	});
});

describe("hintFor", () => {
	it("gives a hint for every guided mode and none for plain tools", () => {
		for (const mode of ["area", "line", "pin", "scale"] as const) {
			expect(hintFor(mode)).toBeTruthy();
			expect(isMarkingMode(mode)).toBe(mode === "area" || mode === "line");
		}
		expect(hintFor("select")).toBeNull();
		expect(hintFor("freedraw")).toBeNull();
	});
});

describe("nextDraft", () => {
	it("tracks an in-progress element and completes when it ends", () => {
		let state = initialDraftState();
		let step = nextDraft(state, "el-1");
		state = step.state;
		expect(step.completedId).toBeNull();

		step = nextDraft(state, "el-1");
		state = step.state;
		expect(step.completedId).toBeNull();

		step = nextDraft(state, null);
		expect(step.completedId).toBe("el-1");
		expect(step.state.pendingId).toBeNull();
	});

	it("does not complete when nothing was in progress", () => {
		const step = nextDraft(initialDraftState(), null);
		expect(step.completedId).toBeNull();
	});

	it("switches tracking when a new element starts", () => {
		let state = initialDraftState();
		state = nextDraft(state, "el-1").state;
		const step = nextDraft(state, "el-2");
		expect(step.state.pendingId).toBe("el-2");
		expect(step.completedId).toBeNull();
	});
});

describe("colors", () => {
	it("parses rgb and rgba strings", () => {
		expect(parseRgbString("rgb(0, 107, 79)")).toEqual([0, 107, 79]);
		expect(parseRgbString("rgba(12,34,56,0.5)")).toEqual([12, 34, 56]);
		expect(parseRgbString("#006B4F")).toBeNull();
		expect(parseRgbString("rgb(999, 0, 0)")).toBeNull();
	});

	it("parses six-digit hex colors", () => {
		expect(parseHexColor("#006b4f")).toEqual([0, 107, 79]);
		expect(parseHexColor("#006B4F")).toEqual([0, 107, 79]);
		expect(parseHexColor("#fff")).toBeNull();
		expect(parseHexColor("rgb(0, 0, 0)")).toBeNull();
	});

	it("mixes toward white", () => {
		expect(mixTowardWhite([0, 107, 79], 1)).toBe("rgb(255, 255, 255)");
		expect(mixTowardWhite([0, 107, 79], 0)).toBe("rgb(0, 107, 79)");
		expect(mixTowardWhite([0, 100, 200], 0.5)).toBe("rgb(128, 178, 228)");
	});
});
