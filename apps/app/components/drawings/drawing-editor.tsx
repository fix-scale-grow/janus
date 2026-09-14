"use client";

import Stamp from "@carbon/icons-react/es/Stamp";
import {
	DRAWINGS,
	type DrawingScale,
	type DrawingScene,
	parseLibraryFileItems,
	polylineLengthFt,
	promoteSymbolPinCustomData,
	type ScopeCustomData,
	scopeCustomData,
	symbolPinCustomData,
} from "@crm/drawings";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { Toggle } from "@crm/ui/components/toggle";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
	ExcalidrawImperativeAPI,
	ExcalidrawProps,
	LibraryItems,
	LibraryItems_anyVersion,
} from "@excalidraw/excalidraw/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AgentPanel } from "@/components/crm/agent-panel";
import { InlineTextCell } from "@/components/crm/inline-field";
import { useRecentTouch } from "@/components/nav/use-recent-touch";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { DrawingHistory } from "./drawing-history";
import { DrawingToolbar, type OverflowAction } from "./drawing-toolbar";
import { JanusExcalidraw } from "./janus-excalidraw";
import { SatelliteCanvas } from "./satellite-canvas";
import { ScaleDialog } from "./scale-dialog";
import { initialSceneChangeState, nextSceneChange } from "./scene-change";
import { ScopePanel, type ScopeShapeUpdate } from "./scope-panel";
import { SymbolPalette } from "./symbol-palette";
import {
	excalidrawToolFor,
	hintFor,
	initialDraftState,
	isMarkingMode,
	mixTowardWhite,
	modeForExcalidrawTool,
	nextDraft,
	parseHexColor,
	parseRgbString,
	type ToolMode,
} from "./toolbar-modes";
import { useBackgroundImage } from "./use-background-image";
import { useDrawingAutosave } from "./use-drawing-autosave";
import { useDrawingThumbnail } from "./use-drawing-thumbnail";
import { useScopedShapes } from "./use-scoped-shapes";

const toolParser = parseAsStringLiteral(["freedraw"] as const);

type OnChange = NonNullable<ExcalidrawProps["onChange"]>;
type OnPointerDown = NonNullable<ExcalidrawProps["onPointerDown"]>;

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

const FALLBACK_ACCENT: [number, number, number] = [0, 107, 79];

function accentColors(): { stroke: string; fill: string } {
	let rgb: [number, number, number] | null = null;
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue("--primary")
		.trim();
	const context = document.createElement("canvas").getContext("2d");
	if (raw && context) {
		context.fillStyle = raw;
		const normalized = context.fillStyle;
		rgb = parseHexColor(normalized) ?? parseRgbString(normalized);
	}
	const channels = rgb ?? FALLBACK_ACCENT;
	return {
		stroke: `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`,
		fill: mixTowardWhite(channels, DRAWINGS.marks.fillWhiteMix),
	};
}

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
	useRecentTouch("drawing", props.drawingId);
	const [title, setTitle] = useState(props.title);
	const [scale, setScale] = useState(props.initialScale);
	const sceneRef = useRef(props.initialScene);
	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const getSceneVersionRef = useRef<
		((elements: readonly ExcalidrawElement[]) => number) | null
	>(null);
	const sceneChangeRef = useRef(initialSceneChangeState());
	const satelliteUpdateRef = useRef<
		((scopeId: string, update: ScopeShapeUpdate) => void) | null
	>(null);
	const [surface, setSurface] = useState<Surface>("sketch");
	const [excalidrawApi, setExcalidrawApi] =
		useState<ExcalidrawImperativeAPI | null>(null);
	const [tool, setTool] = useQueryState("tool", toolParser);
	const initialToolRef = useRef(tool);
	const [mode, setModeState] = useState<ToolMode>(
		initialToolRef.current === "freedraw" ? "freedraw" : "select",
	);
	const modeRef = useRef(mode);
	const draftRef = useRef(initialDraftState());
	const markingArmedRef = useRef(false);
	const calibrationOpenRef = useRef(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [clearOpen, setClearOpen] = useState(false);
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
	const symbols = useQuery(trpc.symbols.list.queryOptions({ pageSize: 100 }));
	const drawingEstimates = useQuery(
		trpc.estimates.list.queryOptions({
			drawingId: props.drawingId,
			pageSize: 5,
		}),
	);
	const newestEstimateId = drawingEstimates.data?.rows[0]?.id ?? null;
	const rename = useMutation(
		trpc.drawings.rename.mutationOptions({
			onSuccess: (result) => {
				setTitle(result.title);
				void cache.drawing(props.drawingId, { settle: "record" });
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const generateEstimate = useMutation(
		trpc.estimates.generateFromDrawing.mutationOptions({
			onSuccess: (result) => {
				void cache.estimate(result.id);
				router.push(workspaceUrl(`/estimates/${result.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const [calibrationTarget, setCalibrationTarget] = useState<{
		elementId: string;
		pixelLength: number;
	} | null>(null);
	const [askJanusOpen, setAskJanusOpen] = useState(false);

	const setMode = useCallback((next: ToolMode) => {
		modeRef.current = next;
		markingArmedRef.current = false;
		setModeState(next);
		const api = apiRef.current;
		if (!api) return;
		if (next === "pin") {
			api.setActiveTool({ type: "custom", customType: "janus-pin" });
			return;
		}
		if (next === "scale") {
			api.updateScene({ appState: { selectedElementIds: {} } });
		}
		api.setActiveTool({ type: excalidrawToolFor(next) });
	}, []);

	const cancelDraft = useCallback(() => {
		const pendingId = draftRef.current.pendingId;
		draftRef.current = initialDraftState();
		if (!pendingId) return;
		setTimeout(() => {
			const api = apiRef.current;
			if (!api) return;
			void import("@excalidraw/excalidraw").then(
				({ CaptureUpdateAction, newElementWith }) => {
					const elements = api
						.getSceneElements()
						.map((element) =>
							element.id === pendingId
								? newElementWith(element, { isDeleted: true })
								: element,
						);
					api.updateScene({
						elements,
						captureUpdate: CaptureUpdateAction.IMMEDIATELY,
					});
				},
			);
		}, 0);
	}, []);

	const exitMode = useCallback(() => {
		cancelDraft();
		setMode("select");
	}, [cancelDraft, setMode]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (modeRef.current === "select") return;
			exitMode();
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [exitMode]);

	const excalidrawApiRef = useCallback(
		(api: ExcalidrawImperativeAPI) => {
			apiRef.current = api;
			setExcalidrawApi(api);
			if (tool === "freedraw") void setTool(null);
		},
		[tool, setTool],
	);

	useEffect(() => {
		let cancelled = false;
		void import("@excalidraw/excalidraw").then(({ getSceneVersion }) => {
			if (!cancelled) getSceneVersionRef.current = getSceneVersion;
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!excalidrawApi) return;

		let cancelled = false;

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

		void installLibraryFromUrl();

		const onHashChange = () => {
			void installLibraryFromUrl();
		};
		window.addEventListener("hashchange", onHashChange);
		return () => {
			cancelled = true;
			window.removeEventListener("hashchange", onHashChange);
		};
	}, [excalidrawApi]);

	const stampElements = useCallback(
		async (elementIds: string[], kind: "area" | "line") => {
			const api = apiRef.current;
			if (!api || elementIds.length === 0) return;
			const { CaptureUpdateAction, newElementWith } = await import(
				"@excalidraw/excalidraw"
			);
			const accent = accentColors();
			const elements = api.getSceneElements().map((element) => {
				if (!elementIds.includes(element.id)) return element;
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
					strokeColor: accent.stroke,
					roundness: null,
					...(kind === "area"
						? { backgroundColor: accent.fill, fillStyle: "solid" as const }
						: {}),
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

	const stampSelection = useCallback(
		async (kind: "area" | "line") => {
			const api = apiRef.current;
			if (!api) return;
			const appState = api.getAppState();
			const selectedIds = Object.keys(appState.selectedElementIds).filter(
				(id) => appState.selectedElementIds[id],
			);
			if (selectedIds.length === 0) {
				toast.info("Select one or more shapes first.");
				return;
			}
			await stampElements(selectedIds, kind);
		},
		[stampElements],
	);

	const completeDraft = useCallback(
		(elementId: string, kind: "area" | "line") => {
			const api = apiRef.current;
			if (!api) return;
			const element = api
				.getSceneElements()
				.find((candidate) => candidate.id === elementId);
			if (!element || element.isDeleted) return;
			const points = "points" in element ? element.points : [];
			if (kind === "area" && points.length < 3) {
				toast.info("An area needs at least three points.");
				setMode("select");
				return;
			}
			void stampElements([elementId], kind).then(() => {
				toast.success(
					kind === "area"
						? "Area marked and added to scope."
						: "Line marked and added to scope.",
				);
			});
			setMode("select");
		},
		[stampElements, setMode],
	);

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

			const getVersion = getSceneVersionRef.current;
			const version = getVersion ? getVersion(elements) : null;
			const decision = nextSceneChange(sceneChangeRef.current, version);
			sceneChangeRef.current = decision.state;
			if (decision.save) queueSave();

			const currentMode = modeRef.current;
			const activeType = appState.activeTool.type;

			if (isMarkingMode(currentMode)) {
				if (activeType === "line") markingArmedRef.current = true;
				const inProgress = appState.multiElement ?? appState.newElement;
				const inProgressId =
					inProgress && inProgress.type === "line" ? inProgress.id : null;
				const step = nextDraft(draftRef.current, inProgressId);
				draftRef.current = step.state;
				if (step.completedId) {
					const completedId = step.completedId;
					const kind = currentMode === "area" ? "area" : "line";
					setTimeout(() => completeDraft(completedId, kind), 0);
				} else if (
					markingArmedRef.current &&
					activeType !== "line" &&
					!inProgressId
				) {
					modeRef.current = "select";
					setModeState("select");
				}
			} else if (currentMode === "pin") {
				if (activeType !== "custom") {
					const mapped = modeForExcalidrawTool(activeType);
					modeRef.current = mapped ?? "select";
					setModeState(mapped ?? "select");
				}
			} else if (currentMode === "scale") {
				const selectedIds = Object.keys(appState.selectedElementIds).filter(
					(id) => appState.selectedElementIds[id],
				);
				if (!calibrationOpenRef.current && selectedIds.length === 1) {
					const target = elements.find(
						(element) => element.id === selectedIds[0],
					);
					if (target && isCalibrationCandidate(target) && !target.isDeleted) {
						calibrationOpenRef.current = true;
						setCalibrationTarget({
							elementId: target.id,
							pixelLength: polylineLengthFt(elementPoints(target), 1),
						});
					}
				}
			} else {
				const mapped = modeForExcalidrawTool(activeType);
				if (mapped && mapped !== currentMode) {
					modeRef.current = mapped;
					setModeState(mapped);
				}
			}
		},
		[queueSave, completeDraft],
	);

	const placePin = useCallback(
		async (scenePoint: { x: number; y: number }) => {
			const api = apiRef.current;
			if (!api) return;
			const { CaptureUpdateAction, convertToExcalidrawElements } = await import(
				"@excalidraw/excalidraw"
			);
			const size = DRAWINGS.pin.sizePx;
			const accent = accentColors();
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
					x: scenePoint.x - size / 2,
					y: scenePoint.y - size / 2,
					width: size,
					height: size,
					strokeColor: accent.stroke,
					backgroundColor: accent.fill,
					fillStyle: "solid",
					customData,
				},
			]);
			if (!pin) return;

			api.updateScene({
				elements: [...api.getSceneElements(), pin],
				captureUpdate: CaptureUpdateAction.IMMEDIATELY,
			});
			queueSave();
		},
		[queueSave],
	);

	const onPointerDown = useCallback<OnPointerDown>(
		(activeTool, pointerDownState) => {
			if (modeRef.current !== "pin") return;
			if (activeTool.type !== "custom") return;
			void placePin(pointerDownState.origin);
			setMode("select");
		},
		[placePin, setMode],
	);

	const exportImage = useCallback(async () => {
		const api = apiRef.current;
		if (!api) return;
		const { exportToBlob } = await import("@excalidraw/excalidraw");
		const blob = await exportToBlob({
			elements: api.getSceneElements(),
			appState: { ...api.getAppState(), exportBackground: true },
			files: api.getFiles(),
			mimeType: "image/png",
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${props.title || "drawing"}.png`;
		anchor.click();
		URL.revokeObjectURL(url);
	}, [props.title]);

	const setCanvasBackground = useCallback(
		(color: string) => {
			const api = apiRef.current;
			if (!api) return;
			api.updateScene({ appState: { viewBackgroundColor: color } });
			queueSave();
		},
		[queueSave],
	);

	const clearCanvas = useCallback(async () => {
		const api = apiRef.current;
		if (!api) return;
		const { CaptureUpdateAction, newElementWith } = await import(
			"@excalidraw/excalidraw"
		);
		const elements = api
			.getSceneElements()
			.map((element) => newElementWith(element, { isDeleted: true }));
		api.updateScene({
			elements,
			appState: { selectedElementIds: {} },
			captureUpdate: CaptureUpdateAction.IMMEDIATELY,
		});
		queueSave();
		toast.success("Canvas cleared. Undo or version history brings it back.");
	}, [queueSave]);

	const handleOverflowAction = useCallback(
		(action: OverflowAction) => {
			if (action === "background") openFilePicker();
			if (action === "history") setHistoryOpen(true);
			if (action === "mark-area") void stampSelection("area");
			if (action === "mark-line") void stampSelection("line");
			if (action === "export") void exportImage();
			if (action === "clear") setClearOpen(true);
		},
		[openFilePicker, stampSelection, exportImage],
	);

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
					...promoteSymbolPinCustomData(symbolParsed.data, element.id),
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
		(feet: number, gridFt: number | null) => {
			if (!calibrationTarget) return;
			const pixelsPerFoot = calibrationTarget.pixelLength / feet;
			setScale({
				pixelsPerFoot,
				referenceElementId: calibrationTarget.elementId,
				gridFt,
			});
			calibrationOpenRef.current = false;
			setCalibrationTarget(null);
			setMode("select");
			queueSave();
		},
		[calibrationTarget, queueSave, setMode],
	);

	useEffect(() => {
		const api = excalidrawApi;
		if (!api) return;
		if (scale?.gridFt) {
			const gridSize = Math.max(
				1,
				Math.round(scale.pixelsPerFoot * scale.gridFt),
			);
			api.updateScene({
				appState: { gridModeEnabled: true, gridSize, gridStep: gridSize },
			});
		} else {
			api.updateScene({ appState: { gridModeEnabled: false } });
		}
	}, [scale, excalidrawApi]);

	const hint = surface === "sketch" ? hintFor(mode) : null;
	const scaleLabel = scale
		? `${Math.round(scale.pixelsPerFoot * 10) / 10} px/ft`
		: null;

	return (
		<div className="flex h-full w-full min-w-0">
			<div className="relative h-full min-h-0 min-w-0 flex-1">
				<div
					className={
						surface === "sketch"
							? "janus-drawing-canvas h-full min-h-0 w-full"
							: "hidden"
					}
				>
					<style>{`
						.janus-drawing-canvas .default-sidebar-trigger { display: none; }
						.janus-drawing-canvas .App-toolbar__extra-tools-trigger { display: none; }
						.janus-drawing-canvas .App-toolbar-container { display: none; }
						.janus-drawing-canvas .App-menu__left { margin-left: 56px; }
						.janus-drawing-canvas .main-menu-trigger { display: none; }
						.excalidraw-modal-container .HelpDialog__header { display: none; }
					`}</style>
					<JanusExcalidraw
						excalidrawAPI={excalidrawApiRef}
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
						onPointerDown={onPointerDown}
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

				<div className="absolute top-3 left-3 z-10 flex items-center gap-2">
					<div className="w-48 rounded-md border border-border bg-background">
						<InlineTextCell
							label="Drawing title"
							value={title}
							saving={rename.isPending}
							onSave={(next) => {
								if (!next) return;
								rename.mutate({ id: props.drawingId, title: next });
							}}
						/>
					</div>
					{props.maptilerApiKey && (
						<Tabs
							onValueChange={(value) => {
								exitMode();
								setSurface(value as Surface);
							}}
							value={surface}
						>
							<TabsList>
								<TabsTrigger value="sketch">Sketch</TabsTrigger>
								<TabsTrigger value="satellite">Satellite</TabsTrigger>
							</TabsList>
						</Tabs>
					)}
				</div>

				<Button
					className="absolute top-3 right-3 z-10"
					onClick={() => setAskJanusOpen(true)}
					variant="outline"
				>
					Ask Janus
				</Button>

				{surface === "sketch" && (
					<DrawingToolbar
						mode={mode}
						onModeChange={(next) => {
							if (next === modeRef.current) return;
							cancelDraft();
							setMode(next);
						}}
						onCanvasBackground={setCanvasBackground}
						onOverflowAction={handleOverflowAction}
						scaleLabel={scaleLabel}
						symbolPalette={
							<SymbolPalette
								apiRef={apiRef}
								queueSave={queueSave}
								scale={scale}
								services={services.data?.rows ?? []}
								side="right"
								trigger={
									<Toggle aria-label="Symbols" pressed={false}>
										<Icon icon={Stamp} />
									</Toggle>
								}
							/>
						}
					/>
				)}

				{hint && (
					<div className="-translate-x-1/2 absolute top-3 left-1/2 z-10 flex items-center gap-2 rounded-lg bg-foreground py-1.5 pr-1.5 pl-3 text-background text-sm shadow-md">
						<span>{hint}</span>
						<Button onClick={exitMode} size="sm" variant="secondary">
							Cancel
						</Button>
					</div>
				)}

				{surface === "sketch" && scaleLabel && (
					<div className="-translate-x-1/2 absolute bottom-3 left-1/2 z-10 rounded-lg border border-border bg-background px-3 py-1.5 text-muted-foreground text-xs shadow-md">
						Scale{" "}
						<span className="font-medium text-foreground">{scaleLabel}</span>
						{scale?.gridFt ? ` · grid ${scale.gridFt} ft` : ""}
					</div>
				)}

				<input
					accept="image/*"
					className="hidden"
					onChange={handleFileChange}
					ref={inputRef}
					type="file"
				/>
			</div>

			<ScopePanel
				generating={generateEstimate.isPending}
				hasEstimate={newestEstimateId !== null}
				onGenerate={async () => {
					await flushPending();
					generateEstimate.mutate({ drawingId: props.drawingId });
				}}
				onOpenEstimate={async () => {
					if (!newestEstimateId) return;
					await flushPending();
					router.push(workspaceUrl(`/estimates/${newestEstimateId}`));
				}}
				onUpdateShape={updateShape}
				services={services.data?.rows ?? []}
				shapes={shapes}
				symbols={symbols.data?.rows ?? []}
			/>

			<ScaleDialog
				defaultGridFt={scale?.gridFt ?? null}
				onConfirm={confirmScale}
				onOpenChange={(open) => {
					if (!open) {
						calibrationOpenRef.current = false;
						setCalibrationTarget(null);
						setMode("select");
					}
				}}
				open={calibrationTarget !== null}
				replacing={scale !== null}
			/>

			<DrawingHistory
				drawingId={props.drawingId}
				onOpenChange={setHistoryOpen}
				onRestored={handleRestored}
				open={historyOpen}
			/>

			<AlertDialog onOpenChange={setClearOpen} open={clearOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Clear the canvas?</AlertDialogTitle>
						<AlertDialogDescription>
							Every shape, measurement and pin on this drawing is removed. Undo
							or version history brings them back.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setClearOpen(false);
								void clearCanvas();
							}}
						>
							Clear canvas
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Sheet onOpenChange={setAskJanusOpen} open={askJanusOpen}>
				<SheetContent className="gap-0 p-0" size="lg">
					<SheetHeader className="border-b">
						<SheetTitle>Ask Janus</SheetTitle>
					</SheetHeader>
					<AgentPanel record={{ kind: "drawing", id: props.drawingId }} />
				</SheetContent>
			</Sheet>
		</div>
	);
}
