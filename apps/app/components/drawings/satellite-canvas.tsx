"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { DrawingScene } from "@crm/drawings";
import { Button } from "@crm/ui/components/button";
import { useEffect } from "react";
import type { ScopeShapeUpdate } from "./scope-panel";
import { useSatelliteFeatures } from "./use-satellite-features";

export type SatelliteCanvasProps = {
	sceneRef: { current: DrawingScene };
	address: string | null;
	apiKey: string;
	queueSave: () => void;
	updateShapeRef: {
		current: ((scopeId: string, update: ScopeShapeUpdate) => void) | null;
	};
};

export function SatelliteCanvas(props: SatelliteCanvasProps) {
	const { containerRef, mode, setMode, updateFeatureScope } =
		useSatelliteFeatures({
			sceneRef: props.sceneRef,
			address: props.address,
			apiKey: props.apiKey,
			queueSave: props.queueSave,
		});

	useEffect(() => {
		props.updateShapeRef.current = updateFeatureScope;
		return () => {
			props.updateShapeRef.current = null;
		};
	}, [props.updateShapeRef, updateFeatureScope]);

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<div className="flex items-center gap-2 border-border border-b p-2">
				<Button
					onClick={() => setMode("polygon")}
					variant={mode === "polygon" ? "default" : "outline"}
				>
					Draw area
				</Button>
				<Button
					onClick={() => setMode("linestring")}
					variant={mode === "linestring" ? "default" : "outline"}
				>
					Draw line
				</Button>
				<Button
					onClick={() => setMode("select")}
					variant={mode === "select" ? "default" : "outline"}
				>
					Select
				</Button>
			</div>
			<div className="min-h-0 flex-1" ref={containerRef} />
		</div>
	);
}
