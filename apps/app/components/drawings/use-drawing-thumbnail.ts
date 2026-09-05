"use client";

import { DRAWINGS } from "@crm/drawings";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function useDrawingThumbnail(drawingId: string) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const lastCaptureAt = useRef(0);

	const setThumbnail = useMutation(
		trpc.drawings.setThumbnail.mutationOptions({
			onSuccess: () => cache.drawing(drawingId),
		}),
	);

	const capture = useCallback(
		async (api: ExcalidrawImperativeAPI) => {
			const now = Date.now();
			if (now - lastCaptureAt.current < DRAWINGS.thumbnail.minIntervalMs) {
				return;
			}

			const elements = api.getSceneElements();
			if (elements.length === 0) return;

			lastCaptureAt.current = now;

			const { exportToBlob } = await import("@excalidraw/excalidraw");
			const blob = await exportToBlob({
				elements,
				files: api.getFiles(),
				maxWidthOrHeight: DRAWINGS.thumbnail.width,
			});

			if (blob.size > DRAWINGS.thumbnail.maxBytes) return;

			const body = new FormData();
			body.set("drawingId", drawingId);
			body.set("file", blob, "thumbnail.png");

			const response = await fetch("/api/drawings/thumbnail", {
				method: "POST",
				body,
			});
			if (!response.ok) return;

			const result = (await response.json()) as { url: string | null };
			if (!result.url) return;

			setThumbnail.mutate({ id: drawingId, thumbnailUrl: result.url });
		},
		[drawingId, setThumbnail],
	);

	return capture;
}
