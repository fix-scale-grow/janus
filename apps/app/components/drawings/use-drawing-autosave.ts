"use client";

import { DRAWINGS, type DrawingScale, type DrawingScene } from "@crm/drawings";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const TRANSIENT_APP_STATE_KEYS = [
	"collaborators",
	"selectedElementIds",
	"selectedGroupIds",
	"editingGroupId",
	"editingElement",
	"editingLinearElement",
	"newElement",
	"draggingElement",
	"resizingElement",
	"multiElement",
	"selectionElement",
	"suggestedBindings",
	"startBoundElement",
	"contextMenu",
] as const;

function stripAppState(
	appState: Record<string, unknown>,
): Record<string, unknown> {
	const persistable = { ...appState };
	for (const key of TRANSIENT_APP_STATE_KEYS) {
		delete persistable[key];
	}
	return persistable;
}

export function useDrawingAutosave(
	drawingId: string,
	sceneRef: { current: DrawingScene },
	scale: DrawingScale | null,
	onSaved?: () => void,
) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scaleRef = useRef(scale);
	scaleRef.current = scale;

	const saveScene = useMutation(
		trpc.drawings.saveScene.mutationOptions({
			onSuccess: () => {
				cache.drawing(drawingId);
				onSaved?.();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	useEffect(
		() => () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		},
		[],
	);

	const queueSave = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			const scene = sceneRef.current;
			saveScene.mutate({
				id: drawingId,
				scene: {
					...scene,
					excalidraw: {
						...scene.excalidraw,
						appState: stripAppState(scene.excalidraw.appState),
					},
				},
				scale: scaleRef.current,
			});
		}, DRAWINGS.autosave.debounceMs);
	}, [drawingId, saveScene, sceneRef]);

	return { queueSave, saving: saveScene.isPending };
}
