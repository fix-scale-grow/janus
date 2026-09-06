import { db } from "@crm/db";
import {
	type DrawingScale,
	type DrawingScene,
	type ExcalidrawElement,
	type MeasuredQuantity,
	type MeasuredShape,
	measureSatellite,
	measureScene,
	parseDrawingScale,
	parseDrawingScene,
	type ShapeAdjustment,
} from "@crm/drawings";
import { fenceUntrusted } from "./untrusted";

export type ServiceLike = {
	id: string;
	name: string;
	symbolId: string | null;
};

export type SymbolLike = {
	id: string;
	serviceId: string | null;
};

export type ShapeSummary = {
	scopeId: string;
	kind: MeasuredShape["kind"];
	label: string;
	quantity: MeasuredQuantity | null;
	service: string;
	adj: ShapeAdjustment | null;
};

export type TextElementSummary = {
	id: string;
	text: string;
};

export type SceneSummary = {
	shapes: ShapeSummary[];
	textElements: TextElementSummary[];
};

function resolveServiceName(
	shape: MeasuredShape,
	byId: Map<string, ServiceLike>,
	bySymbolId: Map<string, ServiceLike>,
	byRegisteredSymbolId: Map<string, ServiceLike>,
): string | null {
	if (shape.serviceId) {
		return byId.get(shape.serviceId)?.name ?? null;
	}
	if (shape.symbol) {
		return (
			byRegisteredSymbolId.get(shape.symbol)?.name ??
			bySymbolId.get(shape.symbol)?.name ??
			null
		);
	}
	return null;
}

function textOf(element: ExcalidrawElement): string | null {
	const value = (element as { text?: unknown }).text;
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function summarizeScene(
	scene: DrawingScene,
	scale: DrawingScale | null,
	services: ServiceLike[],
	symbols: SymbolLike[],
): SceneSummary {
	const measured = [
		...measureScene(scene, scale),
		...measureSatellite(scene.satellite?.features ?? []),
	];

	const byId = new Map(services.map((service) => [service.id, service]));
	const bySymbolId = new Map(
		services
			.filter((service) => service.symbolId)
			.map((service) => [service.symbolId as string, service]),
	);
	const byRegisteredSymbolId = new Map<string, ServiceLike>();
	for (const symbol of symbols) {
		if (!symbol.serviceId) continue;
		const service = byId.get(symbol.serviceId);
		if (service) byRegisteredSymbolId.set(symbol.id, service);
	}

	const shapes = measured.map((shape) => {
		const serviceName = resolveServiceName(
			shape,
			byId,
			bySymbolId,
			byRegisteredSymbolId,
		);

		return {
			scopeId: shape.scopeId,
			kind: shape.kind,
			label: fenceUntrusted("shape label", shape.label),
			quantity: shape.quantity,
			service: serviceName ?? "unassigned",
			adj: shape.adj ?? null,
		};
	});

	const textElements = scene.excalidraw.elements.flatMap((element) => {
		if (element.isDeleted || element.type !== "text") return [];
		const text = textOf(element);
		if (!text) return [];
		return [{ id: element.id, text: fenceUntrusted("drawing text", text) }];
	});

	return { shapes, textElements };
}

export type EstimateSummary = {
	id: string;
	title: string;
	status: string;
	totalCents: number;
};

const TIER_PRICE_FIELD = {
	GOOD: "priceGoodCents",
	BETTER: "priceBetterCents",
	BEST: "priceBestCents",
} as const;

export type DrawingSummary = {
	found: true;
	drawingId: string;
	title: string;
	deal: { id: string; name: string } | null;
	contact: { id: string; name: string } | null;
	hasScale: boolean;
	gridFt: number | null;
	shapes: ShapeSummary[];
	textElements: TextElementSummary[];
	estimates: EstimateSummary[];
};

export async function loadDrawingSummary(
	drawingId: string,
): Promise<DrawingSummary | { found: false; reason: string }> {
	const drawing = await db.drawing.findUnique({
		where: { id: drawingId },
		select: {
			title: true,
			scene: true,
			scale: true,
			deal: { select: { id: true, name: true } },
			contact: { select: { id: true, firstName: true, lastName: true } },
			estimates: {
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					title: true,
					status: true,
					selectedTier: true,
					lineItems: {
						select: {
							quantity: true,
							priceGoodCents: true,
							priceBetterCents: true,
							priceBestCents: true,
						},
					},
				},
			},
		},
	});

	if (!drawing) return { found: false, reason: "No such drawing." };

	const [services, symbols] = await Promise.all([
		db.service.findMany({
			where: { active: true },
			select: { id: true, name: true, symbolId: true },
		}),
		db.symbol.findMany({ select: { id: true, serviceId: true } }),
	]);

	const scene = parseDrawingScene(drawing.scene);
	const scale = parseDrawingScale(drawing.scale);
	const { shapes, textElements } = summarizeScene(
		scene,
		scale,
		services,
		symbols,
	);

	const contactName = drawing.contact
		? [drawing.contact.firstName, drawing.contact.lastName]
				.filter(Boolean)
				.join(" ")
		: null;

	return {
		found: true,
		drawingId,
		title: fenceUntrusted("drawing title", drawing.title),
		deal: drawing.deal
			? {
					id: drawing.deal.id,
					name: fenceUntrusted("deal title", drawing.deal.name),
				}
			: null,
		contact:
			drawing.contact && contactName
				? {
						id: drawing.contact.id,
						name: fenceUntrusted("contact name", contactName),
					}
				: null,
		hasScale: scale !== null,
		gridFt: scale?.gridFt ?? null,
		shapes,
		textElements,
		estimates: drawing.estimates.map((estimate) => ({
			id: estimate.id,
			title: fenceUntrusted("estimate title", estimate.title),
			status: estimate.status,
			totalCents: estimate.lineItems.reduce(
				(sum, item) =>
					sum +
					Math.round(
						Number(item.quantity) *
							item[TIER_PRICE_FIELD[estimate.selectedTier]],
					),
				0,
			),
		})),
	};
}
