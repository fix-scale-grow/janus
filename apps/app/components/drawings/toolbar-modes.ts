export type ToolMode =
	| "select"
	| "hand"
	| "freedraw"
	| "rectangle"
	| "ellipse"
	| "arrow"
	| "text"
	| "area"
	| "line"
	| "pin"
	| "scale";

export const SHAPE_MODES = [
	"rectangle",
	"ellipse",
	"arrow",
	"text",
] as const satisfies readonly ToolMode[];

export type ShapeMode = (typeof SHAPE_MODES)[number];

export type ExcalidrawToolName =
	| "selection"
	| "hand"
	| "freedraw"
	| "rectangle"
	| "ellipse"
	| "arrow"
	| "line"
	| "text";

const EXCALIDRAW_TOOL_BY_MODE: Record<ToolMode, ExcalidrawToolName> = {
	select: "selection",
	hand: "hand",
	freedraw: "freedraw",
	rectangle: "rectangle",
	ellipse: "ellipse",
	arrow: "arrow",
	text: "text",
	area: "line",
	line: "line",
	pin: "selection",
	scale: "selection",
};

export function excalidrawToolFor(mode: ToolMode): ExcalidrawToolName {
	return EXCALIDRAW_TOOL_BY_MODE[mode];
}

const MODE_BY_EXCALIDRAW_TOOL: Record<string, ToolMode> = {
	selection: "select",
	hand: "hand",
	freedraw: "freedraw",
	rectangle: "rectangle",
	ellipse: "ellipse",
	arrow: "arrow",
	text: "text",
};

export function modeForExcalidrawTool(tool: string): ToolMode | null {
	return MODE_BY_EXCALIDRAW_TOOL[tool] ?? null;
}

export function isMarkingMode(mode: ToolMode): boolean {
	return mode === "area" || mode === "line";
}

export function hintFor(mode: ToolMode): string | null {
	if (mode === "area") {
		return "Click to place points, then click the first point to close the area";
	}
	if (mode === "line") {
		return "Click to place points, then double-click or press Enter to finish";
	}
	if (mode === "pin") return "Click the drawing to drop a pin";
	if (mode === "scale") return "Click a straight line to calibrate";
	return null;
}

export type DraftState = { pendingId: string | null };

export function initialDraftState(): DraftState {
	return { pendingId: null };
}

export function nextDraft(
	state: DraftState,
	inProgressId: string | null,
): { state: DraftState; completedId: string | null } {
	if (inProgressId) {
		if (state.pendingId === inProgressId) return { state, completedId: null };
		return { state: { pendingId: inProgressId }, completedId: null };
	}
	if (state.pendingId) {
		return { state: { pendingId: null }, completedId: state.pendingId };
	}
	return { state, completedId: null };
}

export function mixTowardWhite(
	rgb: readonly [number, number, number],
	whiteRatio: number,
): string {
	const mix = (channel: number) =>
		Math.round(channel + (255 - channel) * whiteRatio);
	return `rgb(${mix(rgb[0])}, ${mix(rgb[1])}, ${mix(rgb[2])})`;
}

export function parseHexColor(value: string): [number, number, number] | null {
	const match = value.trim().match(/^#([0-9a-f]{6})$/i);
	if (!match) return null;
	const hex = match[1] as string;
	return [
		Number.parseInt(hex.slice(0, 2), 16),
		Number.parseInt(hex.slice(2, 4), 16),
		Number.parseInt(hex.slice(4, 6), 16),
	];
}

export function parseRgbString(value: string): [number, number, number] | null {
	const match = value.match(
		/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/,
	);
	if (!match) return null;
	const channels = [match[1], match[2], match[3]].map(Number);
	if (channels.some((channel) => !Number.isFinite(channel) || channel > 255)) {
		return null;
	}
	return channels as [number, number, number];
}
