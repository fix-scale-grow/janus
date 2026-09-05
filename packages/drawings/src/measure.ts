import { PITCH_FACTORS, type PitchKey, SQFT_PER_SQUARE } from "./config";
import {
	type DrawingScale,
	type DrawingScene,
	type ExcalidrawElement,
	type SatelliteFeature,
	type ScopeCustomData,
	scopeCustomData,
	symbolPinCustomData,
} from "./scene";

export type ScopedShape = {
	scopeId: string;
	kind: "area" | "line" | "pin";
	serviceId: string | null;
	label: string | null;
	pitch: PitchKey | null;
	symbol: string | null;
};

export type MeasuredQuantity =
	| { areaSqFt: number; squares: number }
	| { lengthFt: number }
	| { count: number };

export type MeasuredShape = ScopedShape & {
	quantity: MeasuredQuantity | null;
};

export type ServiceUnitLike =
	| "PER_SQUARE"
	| "PER_LINEAR_FT"
	| "PER_EACH"
	| "FLAT";

export function unitCompatibleWithKind(
	unit: ServiceUnitLike,
	kind: ScopedShape["kind"],
): boolean {
	if (unit === "FLAT") return true;
	if (kind === "area") return unit === "PER_SQUARE";
	if (kind === "line") return unit === "PER_LINEAR_FT";
	return unit === "PER_EACH";
}

export function quantityForUnit(
	unit: ServiceUnitLike,
	q: MeasuredQuantity | null,
): number | null {
	if (unit === "FLAT") return 1;
	if (!q) return null;
	if (unit === "PER_SQUARE") {
		if ("squares" in q) {
			return Math.round(q.squares * 100) / 100;
		}
		return null;
	}
	if (unit === "PER_LINEAR_FT") {
		if ("lengthFt" in q) {
			return Math.round(q.lengthFt * 100) / 100;
		}
		return null;
	}
	if (unit === "PER_EACH") {
		if ("count" in q) {
			return q.count;
		}
		return null;
	}
	return null;
}

export function polygonAreaSqFt(
	points: [number, number][],
	pixelsPerFoot: number,
): number {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i] as [number, number];
		const [x2, y2] = points[(i + 1) % points.length] as [number, number];
		sum += x1 * y2 - x2 * y1;
	}
	return Math.abs(sum / 2) / (pixelsPerFoot * pixelsPerFoot);
}

export function polylineLengthFt(
	points: [number, number][],
	pixelsPerFoot: number,
): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const [x1, y1] = points[i - 1] as [number, number];
		const [x2, y2] = points[i] as [number, number];
		total += Math.hypot(x2 - x1, y2 - y1);
	}
	return total / pixelsPerFoot;
}

function shapePoints(element: ExcalidrawElement): [number, number][] {
	if (element.points && element.points.length > 1) {
		return element.points.map(([px, py]) => [element.x + px, element.y + py]);
	}
	const w = element.width ?? 0;
	const h = element.height ?? 0;
	return [
		[element.x, element.y],
		[element.x + w, element.y],
		[element.x + w, element.y + h],
		[element.x, element.y + h],
	];
}

function linearSymbolLengthFt(
	element: ExcalidrawElement,
	pixelsPerFoot: number,
): number {
	if (element.points && element.points.length > 1) {
		const points = element.points.map(([px, py]): [number, number] => [
			element.x + px,
			element.y + py,
		]);
		return polylineLengthFt(points, pixelsPerFoot);
	}
	const w = element.width ?? 0;
	const h = element.height ?? 0;
	return Math.max(w, h) / pixelsPerFoot;
}

function scopeOf(element: ExcalidrawElement): ScopeCustomData | null {
	if (!element.customData) return null;
	const parsed = scopeCustomData.safeParse(element.customData);
	return parsed.success ? parsed.data : null;
}

function measureElement(
	element: ExcalidrawElement,
	scope: ScopeCustomData,
	scale: DrawingScale | null,
): MeasuredQuantity | null {
	if (scope.kind === "pin") return { count: 1 };
	if (!scale) return null;
	const points = shapePoints(element);
	if (scope.kind === "line") {
		return { lengthFt: polylineLengthFt(points, scale.pixelsPerFoot) };
	}
	const factor = scope.pitch ? PITCH_FACTORS[scope.pitch as PitchKey] : 1;
	const areaSqFt = polygonAreaSqFt(points, scale.pixelsPerFoot) * factor;
	return { areaSqFt, squares: areaSqFt / SQFT_PER_SQUARE };
}

function measureSatelliteFeature(
	feature: SatelliteFeature,
	scope: ScopeCustomData,
): MeasuredQuantity | null {
	if (!feature.measured) return null;
	if ("lengthFt" in feature.measured) {
		return { lengthFt: feature.measured.lengthFt };
	}
	const factor = scope.pitch ? PITCH_FACTORS[scope.pitch as PitchKey] : 1;
	const areaSqFt = feature.measured.areaSqFt * factor;
	return { areaSqFt, squares: areaSqFt / SQFT_PER_SQUARE };
}

export function measureSatellite(
	features: SatelliteFeature[],
): MeasuredShape[] {
	const out: MeasuredShape[] = [];
	for (const feature of features) {
		if (!feature.scope) continue;
		out.push({
			scopeId: feature.scope.scopeId,
			kind: feature.scope.kind,
			serviceId: feature.scope.serviceId ?? null,
			label: feature.scope.label ?? null,
			pitch: (feature.scope.pitch as PitchKey | undefined) ?? null,
			symbol: null,
			quantity: measureSatelliteFeature(feature, feature.scope),
		});
	}
	return out;
}

export function measureScene(
	scene: DrawingScene,
	scale: DrawingScale | null,
): MeasuredShape[] {
	const out: MeasuredShape[] = [];
	for (const element of scene.excalidraw.elements) {
		if (element.isDeleted) continue;
		const scope = scopeOf(element);
		if (scope) {
			out.push({
				scopeId: scope.scopeId,
				kind: scope.kind,
				serviceId: scope.serviceId ?? null,
				label: scope.label ?? null,
				pitch: (scope.pitch as PitchKey | undefined) ?? null,
				symbol: scope.symbol ?? null,
				quantity: measureElement(element, scope, scale),
			});
		} else {
			const symbolParsed = symbolPinCustomData.safeParse(element.customData);
			if (symbolParsed.success && symbolParsed.data.linear) {
				out.push({
					scopeId: element.id,
					kind: "line",
					serviceId: null,
					label: null,
					pitch: null,
					symbol: symbolParsed.data.symbol,
					quantity: scale
						? {
								lengthFt:
									Math.round(
										linearSymbolLengthFt(element, scale.pixelsPerFoot) * 100,
									) / 100,
							}
						: null,
				});
			} else if (symbolParsed.success) {
				out.push({
					scopeId: element.id,
					kind: "pin",
					serviceId: null,
					label: null,
					pitch: null,
					symbol: symbolParsed.data.symbol,
					quantity: { count: 1 },
				});
			}
		}
	}
	return out;
}
