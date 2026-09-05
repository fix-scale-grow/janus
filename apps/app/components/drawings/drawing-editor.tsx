"use client";

import "@excalidraw/excalidraw/index.css";

import {
	DRAWINGS,
	type DrawingScale,
	type DrawingScene,
	polylineLengthFt,
	type ScopeCustomData,
	scopeCustomData,
} from "@crm/drawings";
import { Button } from "@crm/ui/components/button";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
	ExcalidrawImperativeAPI,
	ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { ScaleDialog } from "./scale-dialog";
import { ScopePanel, type ScopeShapeUpdate } from "./scope-panel";
import { useDrawingAutosave } from "./use-drawing-autosave";
import { useScopedShapes } from "./use-scoped-shapes";

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

function elementPoints(element: ExcalidrawElement): [number, number][] {
	if ("points" in element && element.points.length > 1) {
		return element.points.map((point): [number, number] => [
			point[0],
			point[1],
		]);
	}
	return [
		[0, 0],
		[element.width, 0],
		[element.width, element.height],
		[0, element.height],
	];
}

function isCalibrationCandidate(element: ExcalidrawElement): boolean {
	return element.type === "line" || element.type === "arrow";
}

export function DrawingEditor(props: DrawingEditorProps) {
	const [scale, setScale] = useState(props.initialScale);
	const sceneRef = useRef(props.initialScene);
	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const { queueSave } = useDrawingAutosave(props.drawingId, sceneRef, scale);
	const shapes = useScopedShapes(sceneRef, scale);

	const [calibrating, setCalibrating] = useState(false);
	const [calibrationTarget, setCalibrationTarget] = useState<{
		elementId: string;
		pixelLength: number;
	} | null>(null);

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

			if (calibrating) {
				const selectedIds = Object.keys(appState.selectedElementIds).filter(
					(id) => appState.selectedElementIds[id],
				);
				if (selectedIds.length === 1) {
					const target = elements.find(
						(element) => element.id === selectedIds[0],
					);
					if (target && isCalibrationCandidate(target) && !target.isDeleted) {
						setCalibrationTarget({
							elementId: target.id,
							pixelLength: polylineLengthFt(elementPoints(target), 1),
						});
						setCalibrating(false);
					}
				}
			}
		},
		[queueSave, calibrating],
	);

	const stampSelection = useCallback(
		async (kind: ScopeCustomData["kind"]) => {
			const api = apiRef.current;
			if (!api) return;
			const appState = api.getAppState();
			const selectedIds = Object.keys(appState.selectedElementIds).filter(
				(id) => appState.selectedElementIds[id],
			);
			if (selectedIds.length === 0) return;

			const { CaptureUpdateAction, newElementWith } = await import(
				"@excalidraw/excalidraw"
			);
			const elements = api.getSceneElements().map((element) => {
				if (!selectedIds.includes(element.id)) return element;
				const customData: ScopeCustomData = {
					scopeId: crypto.randomUUID(),
					kind,
					serviceId: null,
					label: null,
					pitch: null,
				};
				return newElementWith(element, {
					customData: { ...element.customData, ...customData },
				});
			});

			api.updateScene({
				elements,
				captureUpdate: CaptureUpdateAction.IMMEDIATELY,
			});
			queueSave();
		},
		[queueSave],
	);

	const addPin = useCallback(async () => {
		const api = apiRef.current;
		if (!api) return;
		const {
			CaptureUpdateAction,
			convertToExcalidrawElements,
			viewportCoordsToSceneCoords,
		} = await import("@excalidraw/excalidraw");
		const appState = api.getAppState();
		const center = viewportCoordsToSceneCoords(
			{
				clientX: appState.offsetLeft + appState.width / 2,
				clientY: appState.offsetTop + appState.height / 2,
			},
			appState,
		);
		const size = DRAWINGS.pin.sizePx;
		const customData: ScopeCustomData = {
			scopeId: crypto.randomUUID(),
			kind: "pin",
			serviceId: null,
			label: null,
			pitch: null,
		};
		const [pin] = convertToExcalidrawElements([
			{
				type: "ellipse",
				x: center.x - size / 2,
				y: center.y - size / 2,
				width: size,
				height: size,
				customData,
			},
		]);
		if (!pin) return;

		api.updateScene({
			elements: [...api.getSceneElements(), pin],
			captureUpdate: CaptureUpdateAction.IMMEDIATELY,
		});
		queueSave();
	}, [queueSave]);

	const updateShape = useCallback(
		async (scopeId: string, update: ScopeShapeUpdate) => {
			const api = apiRef.current;
			if (!api) return;
			const { CaptureUpdateAction, newElementWith } = await import(
				"@excalidraw/excalidraw"
			);
			const elements = api.getSceneElements().map((element) => {
				const parsed = scopeCustomData.safeParse(element.customData);
				if (!parsed.success || parsed.data.scopeId !== scopeId) return element;
				return newElementWith(element, {
					customData: { ...parsed.data, ...update },
				});
			});
			api.updateScene({
				elements,
				captureUpdate: CaptureUpdateAction.IMMEDIATELY,
			});
			queueSave();
		},
		[queueSave],
	);

	const confirmScale = useCallback(
		(feet: number) => {
			if (!calibrationTarget) return;
			const pixelsPerFoot = calibrationTarget.pixelLength / feet;
			setScale({
				pixelsPerFoot,
				referenceElementId: calibrationTarget.elementId,
			});
			setCalibrationTarget(null);
			queueSave();
		},
		[calibrationTarget, queueSave],
	);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-border border-b p-2">
				<Button onClick={() => setCalibrating(true)} variant="outline">
					Set scale
				</Button>
				<Button onClick={() => stampSelection("area")} variant="outline">
					Mark area
				</Button>
				<Button onClick={() => stampSelection("line")} variant="outline">
					Mark line
				</Button>
				<Button onClick={addPin} variant="outline">
					Pin
				</Button>
				{calibrating && (
					<span className="text-muted-foreground text-xs">
						Select a line to calibrate.
					</span>
				)}
			</div>

			<div className="flex min-h-0 flex-1">
				<div className="h-full min-h-0 flex-1">
					<Excalidraw
						excalidrawAPI={(api) => {
							apiRef.current = api;
						}}
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

				<ScopePanel onUpdateShape={updateShape} shapes={shapes} />
			</div>

			<ScaleDialog
				onConfirm={confirmScale}
				onOpenChange={(open) => {
					if (!open) {
						setCalibrating(false);
						setCalibrationTarget(null);
					}
				}}
				open={calibrationTarget !== null}
			/>
		</div>
	);
}
