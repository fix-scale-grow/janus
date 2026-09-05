"use client";

import {
	type DrawingScale,
	type ExcalidrawElement,
	excalidrawElement,
} from "@crm/drawings";
import { Button } from "@crm/ui/components/button";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { parseSymbolRowsWith, symbolRowBase } from "@/lib/symbol-rows";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const symbolRow = symbolRowBase.extend({
	elements: excalidrawElement.array(),
});

type SymbolRow = z.infer<typeof symbolRow>;

function parseSymbolRows(value: unknown): {
	rows: SymbolRow[];
	failed: number;
} {
	return parseSymbolRowsWith(symbolRow, value);
}

export type SymbolPaletteProps = {
	apiRef: { current: ExcalidrawImperativeAPI | null };
	scale: DrawingScale | null;
	queueSave: () => void;
	services: { id: string; unit: string }[];
};

function symbolPoints(element: ExcalidrawElement): [number, number][] {
	if (element.points && element.points.length > 1) return element.points;
	const w = element.width ?? 0;
	const h = element.height ?? 0;
	return [
		[0, 0],
		[w, 0],
		[w, h],
		[0, h],
	];
}

function elementsBBox(elements: ExcalidrawElement[]) {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const element of elements) {
		for (const [px, py] of symbolPoints(element)) {
			const x = element.x + px;
			const y = element.y + py;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}
	return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function remapGroupIds(elements: ExcalidrawElement[]): ExcalidrawElement[] {
	const remap = new Map<string, string>();
	return elements.map((element) => {
		const groupIds = (element as { groupIds?: unknown }).groupIds;
		if (!Array.isArray(groupIds) || groupIds.length === 0) return element;
		const next = groupIds.map((id) => {
			if (typeof id !== "string") return id;
			const existing = remap.get(id);
			if (existing) return existing;
			const fresh = crypto.randomUUID();
			remap.set(id, fresh);
			return fresh;
		});
		return { ...element, groupIds: next };
	});
}

function scaleAndCenterElements(
	elements: ExcalidrawElement[],
	scale: DrawingScale | null,
	dims: { widthFt: number | null; heightFt: number | null },
	center: { x: number; y: number },
): ExcalidrawElement[] {
	const bbox = elementsBBox(elements);
	let factor = 1;
	if (scale && dims.widthFt && bbox.width > 0) {
		factor = (dims.widthFt * scale.pixelsPerFoot) / bbox.width;
	} else if (scale && dims.heightFt && bbox.height > 0) {
		factor = (dims.heightFt * scale.pixelsPerFoot) / bbox.height;
	}
	const scaledWidth = bbox.width * factor;
	const scaledHeight = bbox.height * factor;
	const offsetX = center.x - scaledWidth / 2;
	const offsetY = center.y - scaledHeight / 2;

	return elements.map((element) => {
		const x = offsetX + (element.x - bbox.minX) * factor;
		const y = offsetY + (element.y - bbox.minY) * factor;
		const next: ExcalidrawElement = { ...element, x, y };
		if (element.width !== undefined) next.width = element.width * factor;
		if (element.height !== undefined) next.height = element.height * factor;
		if (element.points) {
			next.points = element.points.map(([px, py]): [number, number] => [
				px * factor,
				py * factor,
			]);
		}
		return next;
	});
}

const thumbnailCache = new Map<string, string>();

function SymbolThumbnail(props: { symbol: SymbolRow }) {
	const [markup, setMarkup] = useState<string | null>(
		thumbnailCache.get(props.symbol.id) ?? null,
	);

	useEffect(() => {
		if (markup) return;
		let cancelled = false;

		const render = async () => {
			const elements = props.symbol.elements;
			if (elements.length === 0) return;
			const excalidrawModule = await import("@excalidraw/excalidraw");
			const exportSvg = excalidrawModule.exportToSvg as unknown as (opts: {
				elements: unknown;
				appState: { exportBackground: boolean; viewBackgroundColor: string };
				files: null;
			}) => Promise<SVGSVGElement>;
			const svg = await exportSvg({
				elements,
				appState: {
					exportBackground: false,
					viewBackgroundColor: "transparent",
				},
				files: null,
			});
			if (cancelled) return;
			svg.setAttribute("width", "40");
			svg.setAttribute("height", "40");
			const html = svg.outerHTML;
			thumbnailCache.set(props.symbol.id, html);
			setMarkup(html);
		};

		void render();
		return () => {
			cancelled = true;
		};
	}, [markup, props.symbol]);

	return (
		<div
			className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: svg generated locally by excalidraw from our own symbol data, not remote content
			dangerouslySetInnerHTML={markup ? { __html: markup } : undefined}
		/>
	);
}

export function SymbolPalette(props: SymbolPaletteProps) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [open, setOpen] = useState(false);

	const list = useQuery(
		trpc.symbols.list.queryOptions({ active: true, pageSize: 100 }),
	);

	const seedRoofing = useMutation(
		trpc.symbols.seedRoofing.mutationOptions({
			onSuccess: () => {
				void cache.symbol();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const { rows, failed } = useMemo(
		() => parseSymbolRows(list.data?.rows),
		[list.data],
	);

	const reportedFailureRef = useRef(0);
	useEffect(() => {
		if (failed > 0 && failed !== reportedFailureRef.current) {
			toast.error(
				`${failed} symbol${failed === 1 ? "" : "s"} could not be read.`,
			);
		}
		reportedFailureRef.current = failed;
	}, [failed]);

	const serviceUnitById = useMemo(
		() => new Map(props.services.map((service) => [service.id, service.unit])),
		[props.services],
	);

	const grouped = useMemo(() => {
		const byTrade = new Map<string, SymbolRow[]>();
		for (const row of rows) {
			const bucket = byTrade.get(row.trade) ?? [];
			bucket.push(row);
			byTrade.set(row.trade, bucket);
		}
		return Array.from(byTrade.entries());
	}, [rows]);

	const placeSymbol = useCallback(
		async (symbol: SymbolRow) => {
			const api = props.apiRef.current;
			if (!api) return;
			const authored = symbol.elements;
			if (authored.length === 0) return;

			const {
				CaptureUpdateAction,
				convertToExcalidrawElements,
				newElementWith,
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

			const positioned = scaleAndCenterElements(
				remapGroupIds(authored),
				props.scale,
				{ widthFt: symbol.widthFt, heightFt: symbol.heightFt },
				center,
			);

			const inserted = convertToExcalidrawElements(positioned as never, {
				regenerateIds: true,
			});
			const [first, ...rest] = inserted;
			if (!first) return;

			const unit = symbol.serviceId
				? serviceUnitById.get(symbol.serviceId)
				: undefined;
			const stampedFirst = newElementWith(first, {
				customData: {
					...first.customData,
					symbol: symbol.id,
					...(unit === "PER_LINEAR_FT" ? { linear: true } : {}),
				},
			});

			api.updateScene({
				elements: [...api.getSceneElements(), stampedFirst, ...rest],
				captureUpdate: CaptureUpdateAction.IMMEDIATELY,
			});
			props.queueSave();
			setOpen(false);
		},
		[props.apiRef, props.scale, props.queueSave, serviceUnitById],
	);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button variant="outline">Symbols</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80" size="fit">
				<Command>
					<CommandInput placeholder="Search symbols" />
					<CommandList>
						{!list.isLoading && rows.length === 0 && (
							<div className="flex flex-col items-center gap-2 p-4 text-center">
								<p className="text-muted-foreground text-xs">No symbols yet.</p>
								<Button
									disabled={seedRoofing.isPending}
									onClick={() => seedRoofing.mutate()}
									size="sm"
								>
									Load starter symbols
								</Button>
							</div>
						)}
						{grouped.map(([trade, symbols]) => (
							<CommandGroup heading={trade} key={trade}>
								{symbols.map((symbol) => (
									<CommandItem
										key={symbol.id}
										onSelect={() => void placeSymbol(symbol)}
										value={`${symbol.name} ${symbol.serviceName ?? ""}`}
									>
										<SymbolThumbnail symbol={symbol} />
										<div className="flex flex-col">
											<span>{symbol.name}</span>
											<span className="text-muted-foreground text-xs">
												{symbol.serviceName ?? "no service"}
											</span>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
