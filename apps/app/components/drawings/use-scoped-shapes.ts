"use client";

import {
	DRAWINGS,
	type DrawingScale,
	type DrawingScene,
	type MeasuredShape,
	measureSatellite,
	measureScene,
} from "@crm/drawings";
import { useEffect, useState } from "react";

function computeShapes(
	sceneRef: { current: DrawingScene },
	scale: DrawingScale | null,
): MeasuredShape[] {
	return [
		...measureScene(sceneRef.current, scale),
		...measureSatellite(sceneRef.current.satellite?.features ?? []),
	];
}

export function useScopedShapes(
	sceneRef: { current: DrawingScene },
	scale: DrawingScale | null,
): MeasuredShape[] {
	const [shapes, setShapes] = useState<MeasuredShape[]>(() =>
		computeShapes(sceneRef, scale),
	);

	useEffect(() => {
		const interval = setInterval(() => {
			setShapes(computeShapes(sceneRef, scale));
		}, DRAWINGS.scopePanel.recomputeMs);
		return () => clearInterval(interval);
	}, [sceneRef, scale]);

	return shapes;
}
