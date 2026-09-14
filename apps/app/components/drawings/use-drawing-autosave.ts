"use client";

import { DRAWINGS, type DrawingScale, type DrawingScene } from "@crm/drawings";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { createSaveQueue } from "./autosave-queue";

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

export type AutosaveStatus = "saved" | "saving" | "conflict";

function isConflictError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const data = (error as { data?: { code?: string } }).data;
	return data?.code === "CONFLICT";
}

export function useDrawingAutosave(
	drawingId: string,
	sceneRef: { current: DrawingScene },
	scale: DrawingScale | null,
	initialSceneUpdatedAt: string | null,
	onSaved?: () => void,
) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scaleRef = useRef(scale);
	scaleRef.current = scale;
	const stampRef = useRef<string | null>(initialSceneUpdatedAt);
	const conflictedRef = useRef(false);
	const [status, setStatus] = useState<AutosaveStatus>("saved");

	const saveScene = useMutation(trpc.drawings.saveScene.mutationOptions());
	const saveSceneRef = useRef(saveScene);
	saveSceneRef.current = saveScene;
	const onSavedRef = useRef(onSaved);
	onSavedRef.current = onSaved;
	const cacheRef = useRef(cache);
	cacheRef.current = cache;

	useEffect(
		() => () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		},
		[],
	);

	const queue = useMemo(
		() =>
			createSaveQueue(async () => {
				if (conflictedRef.current) return;
				const scene = sceneRef.current;
				try {
					const saved = await saveSceneRef.current.mutateAsync({
						id: drawingId,
						scene: {
							...scene,
							excalidraw: {
								...scene.excalidraw,
								appState: stripAppState(scene.excalidraw.appState),
							},
						},
						scale: scaleRef.current,
						expectedSceneUpdatedAt: stampRef.current,
					});
					stampRef.current = saved.sceneUpdatedAt;
					void cacheRef.current.drawing(drawingId);
					onSavedRef.current?.();
				} catch (error) {
					if (isConflictError(error)) {
						conflictedRef.current = true;
						setStatus("conflict");
					} else {
						toast.error(
							error instanceof Error ? error.message : "Save failed.",
						);
					}
					throw error;
				}
			}),
		[drawingId, sceneRef],
	);

	const settle = useCallback(
		(work: Promise<void>) => {
			void work.finally(() => {
				if (conflictedRef.current) return;
				if (timeoutRef.current === null && queue.idle()) setStatus("saved");
			});
		},
		[queue],
	);

	const queueSave = useCallback(() => {
		if (conflictedRef.current) return;
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		setStatus("saving");
		timeoutRef.current = setTimeout(() => {
			timeoutRef.current = null;
			settle(queue.request());
		}, DRAWINGS.autosave.debounceMs);
	}, [queue, settle]);

	const cancelPending = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = null;
	}, []);

	const flushPending = useCallback(async () => {
		const hadPending = timeoutRef.current !== null;
		cancelPending();
		if (conflictedRef.current) return;
		if (hadPending) {
			setStatus("saving");
			const work = queue.request();
			settle(work);
			await work;
			return;
		}
		await queue.drain();
	}, [cancelPending, queue, settle]);

	return {
		queueSave,
		cancelPending,
		flushPending,
		status,
	};
}
