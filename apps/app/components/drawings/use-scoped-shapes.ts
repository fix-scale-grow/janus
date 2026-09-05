"use client";

import {
	DRAWINGS,
	type DrawingScale,
	type DrawingScene,
	type MeasuredShape,
	measureScene,
} from "@crm/drawings";
import { useEffect, useState } from "react";

export function useScopedShapes(
	sceneRef: { current: DrawingScene },
	scale: DrawingScale | null,
): MeasuredShape[] {
	const [shapes, setShapes] = useState<MeasuredShape[]>(() =>
		measureScene(sceneRef.current, scale),
	);

	useEffect(() => {
		const interval = setInterval(() => {
			setShapes(measureScene(sceneRef.current, scale));
		}, DRAWINGS.scopePanel.recomputeMs);
		return () => clearInterval(interval);
	}, [sceneRef, scale]);

	return shapes;
}
