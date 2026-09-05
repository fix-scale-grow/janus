"use client";

import { DRAWINGS } from "@crm/drawings";
import type { FileId } from "@excalidraw/excalidraw/element/types";
import type {
	DataURL,
	ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import { useCallback, useRef } from "react";

function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

function loadImage(dataURL: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("Could not load image."));
		image.src = dataURL;
	});
}

function downscale(image: HTMLImageElement, maxDimensionPx: number): string {
	const largest = Math.max(image.naturalWidth, image.naturalHeight);
	if (largest <= maxDimensionPx) return image.src;

	const scale = maxDimensionPx / largest;
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(image.naturalWidth * scale);
	canvas.height = Math.round(image.naturalHeight * scale);
	const context = canvas.getContext("2d");
	if (!context) return image.src;

	context.drawImage(image, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/jpeg", DRAWINGS.backgroundImage.jpegQuality);
}

export function useBackgroundImage(
	apiRef: { current: ExcalidrawImperativeAPI | null },
	queueSave: () => void,
) {
	const inputRef = useRef<HTMLInputElement | null>(null);

	const openFilePicker = useCallback(() => {
		inputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0] ?? null;
			event.target.value = "";
			const api = apiRef.current;
			if (!file || !api) return;

			const rawDataUrl = await readAsDataUrl(file);
			const rawImage = await loadImage(rawDataUrl);
			const dataURL = downscale(
				rawImage,
				DRAWINGS.backgroundImage.maxDimensionPx,
			);
			const image =
				dataURL === rawDataUrl ? rawImage : await loadImage(dataURL);

			const {
				CaptureUpdateAction,
				convertToExcalidrawElements,
				viewportCoordsToSceneCoords,
			} = await import("@excalidraw/excalidraw");

			const appState = api.getAppState();
			const topLeft = viewportCoordsToSceneCoords(
				{ clientX: appState.offsetLeft, clientY: appState.offsetTop },
				appState,
			);
			const viewportWidth = appState.width / appState.zoom.value;
			const viewportHeight = appState.height / appState.zoom.value;
			const fitScale = Math.min(
				viewportWidth / image.naturalWidth,
				viewportHeight / image.naturalHeight,
			);
			const width = image.naturalWidth * fitScale;
			const height = image.naturalHeight * fitScale;

			const fileId = crypto.randomUUID() as FileId;
			api.addFiles([
				{
					id: fileId,
					dataURL: dataURL as DataURL,
					mimeType: file.type === "image/png" ? "image/png" : "image/jpeg",
					created: Date.now(),
				},
			]);

			const [backgroundElement] = convertToExcalidrawElements([
				{
					type: "image",
					fileId,
					x: topLeft.x,
					y: topLeft.y,
					width,
					height,
					locked: true,
				},
			]);
			if (!backgroundElement) return;

			api.updateScene({
				elements: [backgroundElement, ...api.getSceneElements()],
				captureUpdate: CaptureUpdateAction.IMMEDIATELY,
			});
			queueSave();
		},
		[apiRef, queueSave],
	);

	return { inputRef, openFilePicker, handleFileChange };
}
