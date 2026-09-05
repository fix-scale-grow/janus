"use client";

import {
	DRAWINGS,
	type DrawingScene,
	type SatelliteFeature,
	type ScopeCustomData,
} from "@crm/drawings";
import area from "@turf/area";
import length from "@turf/length";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type GeoJSONStoreFeatures,
	type GeoJSONStoreGeometries,
	TerraDraw,
	TerraDrawLineStringMode,
	TerraDrawPolygonMode,
	TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { ScopeShapeUpdate } from "./scope-panel";

export type SatelliteMode = "select" | "polygon" | "linestring";

export type UseSatelliteFeaturesArgs = {
	sceneRef: { current: DrawingScene };
	address: string | null;
	apiKey: string;
	queueSave: () => void;
};

export type UseSatelliteFeaturesResult = {
	containerRef: (node: HTMLDivElement | null) => (() => void) | undefined;
	mode: SatelliteMode;
	setMode: (mode: SatelliteMode) => void;
	updateFeatureScope: (scopeId: string, update: ScopeShapeUpdate) => void;
};

function closedRing(coordinates: [number, number][]): [number, number][] {
	const first = coordinates[0];
	const last = coordinates[coordinates.length - 1];
	if (!first || !last) return coordinates;
	if (first[0] === last[0] && first[1] === last[1]) return coordinates;
	return [...coordinates, first];
}

function openRing(ring: [number, number][]): [number, number][] {
	if (ring.length < 2) return ring;
	const first = ring[0];
	const last = ring[ring.length - 1];
	if (first && last && first[0] === last[0] && first[1] === last[1]) {
		return ring.slice(0, -1);
	}
	return ring;
}

function defaultScope(
	id: string,
	kind: SatelliteFeature["kind"],
): ScopeCustomData {
	return { scopeId: id, kind, serviceId: null, label: null, pitch: null };
}

function featureFromGeometry(
	id: string,
	geometry: GeoJSONStoreGeometries,
	existingScope: ScopeCustomData | null,
): SatelliteFeature | null {
	if (geometry.type === "Polygon") {
		const ring = geometry.coordinates[0] as [number, number][] | undefined;
		if (!ring || ring.length < 3) return null;
		const areaSqFt =
			area({ type: "Feature", geometry, properties: {} }) *
			DRAWINGS.satellite.sqftPerSqm;
		return {
			id,
			kind: "area",
			coordinates: openRing(ring),
			measured: { areaSqFt },
			scope: existingScope ?? defaultScope(id, "area"),
		};
	}
	if (geometry.type === "LineString") {
		const coordinates = geometry.coordinates as [number, number][];
		if (coordinates.length < 2) return null;
		const lengthFt = length(
			{ type: "Feature", geometry, properties: {} },
			{ units: "feet" },
		);
		return {
			id,
			kind: "line",
			coordinates,
			measured: { lengthFt },
			scope: existingScope ?? defaultScope(id, "line"),
		};
	}
	return null;
}

function toStoreFeature(feature: SatelliteFeature): GeoJSONStoreFeatures {
	if (feature.kind === "area") {
		return {
			id: feature.id,
			type: "Feature",
			properties: { mode: "polygon" },
			geometry: {
				type: "Polygon",
				coordinates: [closedRing(feature.coordinates)],
			},
		};
	}
	return {
		id: feature.id,
		type: "Feature",
		properties: { mode: "linestring" },
		geometry: { type: "LineString", coordinates: feature.coordinates },
	};
}

export function useSatelliteFeatures(
	args: UseSatelliteFeaturesArgs,
): UseSatelliteFeaturesResult {
	const { sceneRef, queueSave, address, apiKey } = args;
	const mapRef = useRef<import("maplibre-gl").Map | null>(null);
	const drawRef = useRef<TerraDraw | null>(null);
	const moveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [mode, setModeState] = useState<SatelliteMode>("select");

	const setMode = useCallback((next: SatelliteMode) => {
		drawRef.current?.setMode(next);
		setModeState(next);
	}, []);

	const updateFeatureScope = useCallback(
		(scopeId: string, update: ScopeShapeUpdate) => {
			const satellite = sceneRef.current.satellite;
			if (!satellite) return;
			const features = satellite.features.map((feature) => {
				if (!feature.scope || feature.scope.scopeId !== scopeId) {
					return feature;
				}
				return { ...feature, scope: { ...feature.scope, ...update } };
			});
			sceneRef.current = {
				...sceneRef.current,
				satellite: { ...satellite, features },
			};
			queueSave();
		},
		[sceneRef, queueSave],
	);

	const containerRef = useCallback(
		(node: HTMLDivElement | null) => {
			if (drawRef.current) {
				drawRef.current.stop();
				drawRef.current = null;
			}
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
			if (moveTimeoutRef.current) {
				clearTimeout(moveTimeoutRef.current);
				moveTimeoutRef.current = null;
			}
			if (!node) return;

			let cancelled = false;

			(async () => {
				const { Map: MaplibreMap } = await import("maplibre-gl");
				const saved = sceneRef.current.satellite;
				const center = saved?.center ?? DRAWINGS.satellite.fallbackCenter;
				const zoom = saved?.zoom ?? DRAWINGS.satellite.fallbackZoom;

				const map = new MaplibreMap({
					container: node,
					style: `${DRAWINGS.satellite.mapStyleBaseUrl}?key=${apiKey}`,
					center,
					zoom,
				});
				if (cancelled) {
					map.remove();
					return;
				}
				mapRef.current = map;

				map.on("moveend", () => {
					if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
					moveTimeoutRef.current = setTimeout(() => {
						const current = sceneRef.current.satellite;
						const nextCenter = map.getCenter().toArray() as [number, number];
						const nextZoom = map.getZoom();
						sceneRef.current = {
							...sceneRef.current,
							satellite: current
								? { ...current, center: nextCenter, zoom: nextZoom }
								: { center: nextCenter, zoom: nextZoom, features: [] },
						};
						queueSave();
					}, DRAWINGS.satellite.moveThrottleMs);
				});

				map.on("load", () => {
					if (cancelled) return;

					const draw = new TerraDraw({
						adapter: new TerraDrawMapLibreGLAdapter({ map }),
						modes: [
							new TerraDrawSelectMode({
								flags: {
									polygon: {
										feature: {
											draggable: true,
											coordinates: {
												midpoints: true,
												draggable: true,
												deletable: true,
											},
										},
									},
									linestring: {
										feature: {
											draggable: true,
											coordinates: {
												midpoints: true,
												draggable: true,
												deletable: true,
											},
										},
									},
								},
							}),
							new TerraDrawPolygonMode(),
							new TerraDrawLineStringMode(),
						],
					});
					drawRef.current = draw;
					draw.start();
					draw.setMode("select");
					setModeState("select");

					if (saved && saved.features.length > 0) {
						draw.addFeatures(saved.features.map(toStoreFeature));
					}

					draw.on("change", (ids, changeType) => {
						const current = sceneRef.current.satellite ?? {
							center: map.getCenter().toArray() as [number, number],
							zoom: map.getZoom(),
							features: [],
						};
						let features = current.features;
						if (changeType === "delete") {
							const removed = new Set(ids.map(String));
							features = features.filter((feature) => !removed.has(feature.id));
						} else {
							for (const rawId of ids) {
								const id = String(rawId);
								const snapshot = draw.getSnapshotFeature(rawId);
								if (!snapshot) continue;
								const existing = features.find(
									(feature) => feature.id === id,
								)?.scope;
								const built = featureFromGeometry(
									id,
									snapshot.geometry,
									existing ?? null,
								);
								if (!built) continue;
								const index = features.findIndex(
									(feature) => feature.id === id,
								);
								features =
									index === -1
										? [...features, built]
										: features.map((feature, i) =>
												i === index ? built : feature,
											);
							}
						}
						sceneRef.current = {
							...sceneRef.current,
							satellite: {
								center: current.center,
								zoom: current.zoom,
								features,
							},
						};
						queueSave();
					});
				});

				if (!saved && address) {
					try {
						const response = await fetch(
							`${DRAWINGS.satellite.geocodeBaseUrl}/${encodeURIComponent(address)}.json?key=${apiKey}`,
						);
						if (!response.ok || cancelled) return;
						const data = (await response.json()) as {
							features?: { center?: [number, number] }[];
						};
						const found = data.features?.[0]?.center;
						if (!found || cancelled) return;
						map.jumpTo({
							center: found,
							zoom: DRAWINGS.satellite.addressZoom,
						});
						const current = sceneRef.current.satellite;
						sceneRef.current = {
							...sceneRef.current,
							satellite: current
								? {
										...current,
										center: found,
										zoom: DRAWINGS.satellite.addressZoom,
									}
								: {
										center: found,
										zoom: DRAWINGS.satellite.addressZoom,
										features: [],
									},
						};
						queueSave();
					} catch {}
				}
			})();

			return () => {
				cancelled = true;
			};
		},
		[address, apiKey, queueSave, sceneRef],
	);

	useEffect(
		() => () => {
			if (moveTimeoutRef.current) clearTimeout(moveTimeoutRef.current);
			drawRef.current?.stop();
			mapRef.current?.remove();
		},
		[],
	);

	return { containerRef, mode, setMode, updateFeatureScope };
}
