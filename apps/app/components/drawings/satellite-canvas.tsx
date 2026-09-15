"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import Location from "@carbon/icons-react/es/Location";
import type { DrawingScene } from "@crm/drawings";
import { Button } from "@crm/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
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
	const { containerRef, mode, setMode, updateFeatureScope, workerMissing } =
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

	if (workerMissing) {
		return (
			<div className="flex h-full min-h-0 flex-1 items-center justify-center p-8">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={Location} />
						</EmptyMedia>
						<EmptyTitle>The satellite map cannot start here</EmptyTitle>
						<EmptyDescription>
							Run <code>bun run setup:maplibre</code> at the repo root, then
							reload this page.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</div>
		);
	}

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
