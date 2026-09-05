"use client";

import "@excalidraw/excalidraw/index.css";

import type { DrawingScale, DrawingScene } from "@crm/drawings";
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useDrawingAutosave } from "./use-drawing-autosave";

const Excalidraw = dynamic(
	async () => (await import("@excalidraw/excalidraw")).Excalidraw,
	{ ssr: false },
);

type OnChange = NonNullable<ExcalidrawProps["onChange"]>;

export type DrawingBackground = "WHITEBOARD" | "IMAGE" | "SATELLITE";

export type DrawingEditorProps = {
	slug: string;
	drawingId: string;
	title: string;
	background: DrawingBackground;
	address: string | null;
	initialScene: DrawingScene;
	initialScale: DrawingScale | null;
};

export function DrawingEditor(props: DrawingEditorProps) {
	const [scale] = useState(props.initialScale);
	const sceneRef = useRef(props.initialScene);
	const { queueSave } = useDrawingAutosave(props.drawingId, sceneRef, scale);

	const onChange = useCallback<OnChange>(
		(elements, appState, files) => {
			sceneRef.current = {
				...sceneRef.current,
				excalidraw: {
					elements,
					appState,
					files,
				} as unknown as DrawingScene["excalidraw"],
			};
			queueSave();
		},
		[queueSave],
	);

	return (
		<div className="flex h-full flex-col">
			<div className="h-full min-h-0 flex-1">
				<Excalidraw
					initialData={
						{
							elements: props.initialScene.excalidraw.elements,
							appState: props.initialScene.excalidraw.appState,
							files: props.initialScene.excalidraw.files,
						} as unknown as ExcalidrawProps["initialData"]
					}
					onChange={onChange}
				/>
			</div>
		</div>
	);
}
