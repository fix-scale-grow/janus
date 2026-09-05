import { z } from "zod";
import { DRAWINGS, PITCH_FACTORS } from "./config";

const pitchKey = z.enum(Object.keys(PITCH_FACTORS) as [string, ...string[]]);

export const scopeCustomData = z.object({
	scopeId: z.string().min(1),
	kind: z.enum(["area", "line", "pin"]),
	serviceId: z.string().min(1).nullish(),
	label: z.string().max(120).nullish(),
	pitch: pitchKey.nullish(),
	symbol: z.string().min(1).nullish(),
});

export type ScopeCustomData = z.infer<typeof scopeCustomData>;

export const symbolPinCustomData = z
	.object({ symbol: z.string().min(1), linear: z.boolean().optional() })
	.loose();

export type SymbolPinCustomData = z.infer<typeof symbolPinCustomData>;

export const excalidrawElement = z
	.object({
		id: z.string(),
		type: z.string(),
		x: z.number(),
		y: z.number(),
		width: z.number().optional(),
		height: z.number().optional(),
		angle: z.number().optional(),
		isDeleted: z.boolean().optional(),
		points: z.array(z.tuple([z.number(), z.number()])).optional(),
		customData: z.record(z.string(), z.unknown()).optional(),
	})
	.loose();

export type ExcalidrawElement = z.infer<typeof excalidrawElement>;

export const excalidrawSceneData = z.object({
	elements: z.array(excalidrawElement),
	appState: z.record(z.string(), z.unknown()),
	files: z.record(z.string(), z.unknown()),
});

export type ExcalidrawSceneData = z.infer<typeof excalidrawSceneData>;

export const libraryFileEnvelope = z
	.object({
		libraryItems: z.array(z.unknown()).optional(),
		library: z.array(z.unknown()).optional(),
	})
	.loose();

export function parseLibraryFileItems(value: unknown): unknown[] {
	const parsed = libraryFileEnvelope.parse(value);
	return parsed.libraryItems ?? parsed.library ?? [];
}

export function parseStoredLibraryItems(value: unknown): unknown[] {
	return z.array(z.unknown()).parse(value);
}

export const satelliteMeasured = z
	.object({ areaSqFt: z.number() })
	.or(z.object({ lengthFt: z.number() }))
	.nullable();

export type SatelliteMeasured = z.infer<typeof satelliteMeasured>;

export const satelliteFeature = z.object({
	id: z.string(),
	kind: z.enum(["area", "line"]),
	coordinates: z.array(z.tuple([z.number(), z.number()])),
	measured: satelliteMeasured,
	scope: scopeCustomData.nullable(),
});

export type SatelliteFeature = z.infer<typeof satelliteFeature>;

export const satelliteScene = z.object({
	center: z.tuple([z.number(), z.number()]),
	zoom: z.number(),
	features: z.array(satelliteFeature),
});

export type SatelliteScene = z.infer<typeof satelliteScene>;

export const drawingScene = z.object({
	excalidraw: excalidrawSceneData,
	satellite: satelliteScene.nullable().default(null),
});

export type DrawingScene = z.infer<typeof drawingScene>;

export const drawingScale = z.object({
	pixelsPerFoot: z.number().positive(),
	referenceElementId: z.string().nullable().default(null),
});

export type DrawingScale = z.infer<typeof drawingScale>;

export function parseDrawingScene(value: unknown): DrawingScene {
	return drawingScene.parse(value);
}

export function parseDrawingScale(value: unknown): DrawingScale | null {
	if (value === null || value === undefined) return null;
	return drawingScale.parse(value);
}

export function emptyScene(): DrawingScene {
	return {
		excalidraw: { elements: [], appState: {}, files: {} },
		satellite: null,
	};
}

export function sceneByteLength(scene: unknown): number {
	return new TextEncoder().encode(JSON.stringify(scene)).length;
}

export function isSceneTooLarge(scene: unknown): boolean {
	return sceneByteLength(scene) > DRAWINGS.limits.maxSceneBytes;
}
