import type { ServiceUnit } from "@crm/db";
import type { MeasuredShape } from "@crm/drawings";
import { quantityForUnit } from "@crm/drawings";

export type ServiceLike = {
	id: string;
	name: string;
	unit: string;
	unitPriceCents: number;
	priceGoodCents: number | null;
	priceBestCents: number | null;
	symbolId: string | null;
};

export type LineItemDraft = {
	serviceId: string;
	name: string;
	unit: ServiceUnit;
	quantity: number;
	priceGoodCents: number;
	priceBetterCents: number;
	priceBestCents: number;
	areaLabel: string | null;
	scopeId: string | null;
	sortOrder: number;
};

function resolveService(
	shape: MeasuredShape,
	byId: Map<string, ServiceLike>,
	bySymbolId: Map<string, ServiceLike>,
): ServiceLike | null {
	if (shape.serviceId) {
		return byId.get(shape.serviceId) ?? null;
	}
	if (shape.symbol) {
		return bySymbolId.get(shape.symbol) ?? null;
	}
	return null;
}

function draftFor(
	service: ServiceLike,
	quantity: number,
	scopeId: string | null,
	areaLabel: string | null,
	sortOrder: number,
): LineItemDraft {
	return {
		serviceId: service.id,
		name: service.name,
		unit: service.unit as ServiceUnit,
		quantity,
		priceGoodCents: service.priceGoodCents ?? service.unitPriceCents,
		priceBetterCents: service.unitPriceCents,
		priceBestCents: service.priceBestCents ?? service.unitPriceCents,
		areaLabel,
		scopeId,
		sortOrder,
	};
}

export function buildLineItems(
	shapes: MeasuredShape[],
	services: ServiceLike[],
): LineItemDraft[] {
	const byId = new Map(services.map((service) => [service.id, service]));
	const bySymbolId = new Map(
		services
			.filter((service) => service.symbolId)
			.map((service) => [service.symbolId as string, service]),
	);

	const items: LineItemDraft[] = [];
	const aggregated = new Map<string, LineItemDraft>();

	for (const shape of shapes) {
		const service = resolveService(shape, byId, bySymbolId);
		if (!service) continue;

		const quantity = quantityForUnit(
			service.unit as "PER_SQUARE" | "PER_LINEAR_FT" | "PER_EACH" | "FLAT",
			shape.quantity,
		);
		if (quantity === null) continue;

		if (service.unit === "PER_EACH" && !shape.serviceId && shape.symbol) {
			const existing = aggregated.get(service.id);
			if (existing) {
				existing.quantity += quantity;
				continue;
			}
			const draft = draftFor(service, quantity, null, null, items.length);
			aggregated.set(service.id, draft);
			items.push(draft);
			continue;
		}

		items.push(
			draftFor(service, quantity, shape.scopeId, shape.label, items.length),
		);
	}

	return items.map((item, index) => ({ ...item, sortOrder: index }));
}
