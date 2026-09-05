"use client";

import "@excalidraw/excalidraw/index.css";

import {
	DRAWINGS,
	type DrawingScale,
	type DrawingScene,
	parseLibraryFileItems,
	parseStoredLibraryItems,
	polylineLengthFt,
	type ScopeCustomData,
	scopeCustomData,
	symbolPinCustomData,
} from "@crm/drawings";
import { Button } from "@crm/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
	ExcalidrawImperativeAPI,
	ExcalidrawProps,
	LibraryItems,
	LibraryItems_anyVersion,
} from "@excalidraw/excalidraw/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { DrawingHistory } from "./drawing-history";
import { SatelliteCanvas } from "./satellite-canvas";
import { ScaleDialog } from "./scale-dialog";
import { ScopePanel, type ScopeShapeUpdate } from "./scope-panel";
import { useBackgroundImage } from "./use-background-image";
import { useDrawingAutosave } from "./use-drawing-autosave";
import { useDrawingThumbnail } from "./use-drawing-thumbnail";
import { useScopedShapes } from "./use-scoped-shapes";

const toolParser = parseAsStringLiteral(["freedraw"] as const);

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
	maptilerApiKey: string | null;
};

type Surface = "sketch" | "satellite";

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
	const satelliteUpdateRef = useRef<
		((scopeId: string, update: ScopeShapeUpdate) => void) | null
	>(null);
	const [surface, setSurface] = useState<Surface>("sketch");
	const [excalidrawApi, setExcalidrawApi] =
		useState<ExcalidrawImperativeAPI | null>(null);
	const [tool, setTool] = useQueryState("tool", toolParser);
	const initialToolRef = useRef(tool);
	const captureThumbnail = useDrawingThumbnail(props.drawingId);
	const { queueSave, cancelPending, flushPending } = useDrawingAutosave(
		props.drawingId,
		sceneRef,
		scale,
		() => {
			if (apiRef.current) void captureThumbnail(apiRef.current);
		},
	);
	const shapes = useScopedShapes(sceneRef, scale);
	const { inputRef, openFilePicker, handleFileChange } = useBackgroundImage(
		apiRef,
		queueSave,
	);
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const services = useQuery(
		trpc.services.list.queryOptions({ active: true, pageSize: 100 }),
	);
	const drawingEstimates = useQuery(
		trpc.estimates.list.queryOptions({
			drawingId: props.drawingId,
			pageSize: 5,
		}),
	);
	const newestEstimateId = drawingEstimates.data?.rows[0]?.id ?? null;
	const generateEstimate = useMutation(
		trpc.estimates.generateFromDrawing.mutationOptions({
			onSuccess: (result) => {
				void cache.estimate(result.id);
				router.push(workspaceUrl(`/estimates/${result.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const [calibrating, setCalibrating] = useState(false);
	const [calibrationTarget, setCalibrationTarget] = useState<{
		elementId: string;
		pixelLength: number;
	} | null>(null);

	const excalidrawApiRef = useCallback(
		(api: ExcalidrawImperativeAPI) => {
			apiRef.current = api;
			setExcalidrawApi(api);
			if (tool === "freedraw") void setTool(null);
		},
		[tool, setTool],
	);

	const onLibraryChange = useCallback((libraryItems: LibraryItems) => {
		try {
			window.localStorage.setItem(
				DRAWINGS.library.storageKey,
				JSON.stringify(libraryItems),
			);
		} catch {
			return;
		}
	}, []);

	useEffect(() => {
		if (!excalidrawApi) return;

		let cancelled = false;

		const loadPersistedLibrary = async () => {
			let stored: unknown[] | null = null;
			try {
				const raw = window.localStorage.getItem(DRAWINGS.library.storageKey);
				stored = raw ? parseStoredLibraryItems(JSON.parse(raw)) : null;
			} catch {
				stored = null;
			}
			if (stored && stored.length > 0 && !cancelled) {
				const { restoreLibraryItems } = await import("@excalidraw/excalidraw");
				await excalidrawApi.updateLibrary({
					libraryItems: restoreLibraryItems(
						stored as unknown as LibraryItems_anyVersion,
						"unpublished",
					),
					merge: true,
				});
			}
		};

		const installLibraryFromUrl = async () => {
			const { parseLibraryTokensFromUrl, restoreLibraryItems } = await import(
				"@excalidraw/excalidraw"
			);
			const tokens = parseLibraryTokensFromUrl();
			if (!tokens) return;
			let libraryUrl: URL;
			try {
				libraryUrl = new URL(tokens.libraryUrl);
			} catch {
				return;
			}
			if (
				libraryUrl.protocol !== "https:" ||
				!DRAWINGS.library.allowedHostSuffixes.some((suffix) =>
					libraryUrl.hostname.endsWith(suffix),
				)
			) {
				return;
			}
			const response = await fetch(tokens.libraryUrl);
			if (!response.ok) return;
			let libraryItems: LibraryItems;
			try {
				const raw = parseLibraryFileItems(await response.json());
				libraryItems = restoreLibraryItems(
					raw as unknown as LibraryItems_anyVersion,
					"unpublished",
				);
			} catch {
				return;
			}
			if (cancelled) return;
			await excalidrawApi.updateLibrary({
				libraryItems,
				merge: true,
				openLibraryMenu: true,
			});
			const url = new URL(window.location.href);
			url.hash = "";
			window.history.replaceState({}, "", url.toString());
		};

		const seedTradeLibrary = async () => {
			try {
				if (window.localStorage.getItem(DRAWINGS.library.seededFlagKey)) {
					return;
				}
			} catch {
				return;
			}
			const response = await fetch(DRAWINGS.library.seedUrl);
			if (!response.ok) return;
			let libraryItems: LibraryItems;
			try {
				const { restoreLibraryItems } = await import("@excalidraw/excalidraw");
				const raw = parseLibraryFileItems(await response.json());
				libraryItems = restoreLibraryItems(
					raw as unknown as LibraryItems_anyVersion,
					"published",
				);
			} catch {
				return;
			}
			if (cancelled) return;
			await excalidrawApi.updateLibrary({
				libraryItems,
				merge: true,
				openLibraryMenu: false,
			});
			try {
				window.localStorage.setItem(DRAWINGS.library.seededFlagKey, "1");
			} catch {
				return;
			}
		};

		void loadPersistedLibrary()
			.then(() => {
				if (!cancelled) return seedTradeLibrary();
			})
			.then(() => {
				if (!cancelled) void installLibraryFromUrl();
			});

		const onHashChange = () => {
			void installLibraryFromUrl();
		};
		window.addEventListener("hashchange", onHashChange);
		return () => {
			cancelled = true;
			window.removeEventListener("hashchange", onHashChange);
		};
	}, [excalidrawApi]);

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
				const existingScope = scopeCustomData.safeParse(element.customData);
				const customData: ScopeCustomData = {
					...(existingScope.success ? existingScope.data : null),
					scopeId: existingScope.success
						? existingScope.data.scopeId
						: crypto.randomUUID(),
					kind,
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
			const inSatellite = sceneRef.current.satellite?.features.some(
				(feature) => feature.scope?.scopeId === scopeId,
			);
			if (inSatellite) {
				satelliteUpdateRef.current?.(scopeId, update);
				return;
			}
			const api = apiRef.current;
			if (!api) return;
			const { CaptureUpdateAction, newElementWith } = await import(
				"@excalidraw/excalidraw"
			);
			const elements = api.getSceneElements().map((element) => {
				const parsed = scopeCustomData.safeParse(element.customData);
				if (parsed.success && parsed.data.scopeId === scopeId) {
					return newElementWith(element, {
						customData: { ...parsed.data, ...update },
					});
				}
				if (parsed.success || element.id !== scopeId) return element;
				const symbolParsed = symbolPinCustomData.safeParse(element.customData);
				if (!symbolParsed.success) return element;
				const customData: ScopeCustomData = {
					scopeId: element.id,
					kind: "pin",
					serviceId: null,
					label: null,
					pitch: null,
					symbol: symbolParsed.data.symbol,
					...update,
				};
				return newElementWith(element, { customData });
			});
			api.updateScene({
				elements,
				captureUpdate: CaptureUpdateAction.IMMEDIATELY,
			});
			queueSave();
		},
		[queueSave],
	);

	const handleRestored = useCallback(() => {
		cancelPending();
		window.location.reload();
	}, [cancelPending]);

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
		<div className="flex h-full w-full min-w-0 flex-col">
			<Tabs
				onValueChange={(value) => setSurface(value as Surface)}
				value={surface}
			>
				<div className="flex items-center gap-2 border-border border-b p-2">
					<TabsList>
						<TabsTrigger value="sketch">Sketch</TabsTrigger>
						{props.maptilerApiKey && (
							<TabsTrigger value="satellite">Satellite</TabsTrigger>
						)}
					</TabsList>

					<DrawingHistory
						drawingId={props.drawingId}
						onRestored={handleRestored}
					/>

					{surface === "sketch" && (
						<>
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
							<Button onClick={openFilePicker} variant="outline">
								Set background photo
							</Button>
							<input
								accept="image/*"
								className="hidden"
								onChange={handleFileChange}
								ref={inputRef}
								type="file"
							/>
							{calibrating && (
								<span className="text-muted-foreground text-xs">
									Select a line to calibrate.
								</span>
							)}
						</>
					)}
				</div>
			</Tabs>

			<div className="flex min-h-0 flex-1">
				<div
					className={surface === "sketch" ? "h-full min-h-0 flex-1" : "hidden"}
				>
					<Excalidraw
						excalidrawAPI={excalidrawApiRef}
						libraryReturnUrl={
							typeof window !== "undefined" ? window.location.href : undefined
						}
						onLibraryChange={onLibraryChange}
						initialData={
							{
								elements: props.initialScene.excalidraw.elements,
								appState: {
									...props.initialScene.excalidraw.appState,
									...(initialToolRef.current === "freedraw"
										? { activeTool: { type: "freedraw", customType: null } }
										: {}),
								},
								files: props.initialScene.excalidraw.files,
							} as unknown as ExcalidrawProps["initialData"]
						}
						onChange={onChange}
					/>
				</div>

				{surface === "satellite" && props.maptilerApiKey && (
					<SatelliteCanvas
						address={props.address}
						apiKey={props.maptilerApiKey}
						queueSave={queueSave}
						sceneRef={sceneRef}
						updateShapeRef={satelliteUpdateRef}
					/>
				)}

				<ScopePanel
					generating={generateEstimate.isPending}
					hasEstimate={newestEstimateId !== null}
					onGenerate={async () => {
						await flushPending();
						generateEstimate.mutate({ drawingId: props.drawingId });
					}}
					onOpenEstimate={() => {
						if (!newestEstimateId) return;
						router.push(workspaceUrl(`/estimates/${newestEstimateId}`));
					}}
					onUpdateShape={updateShape}
					services={services.data?.rows ?? []}
					shapes={shapes}
				/>
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
