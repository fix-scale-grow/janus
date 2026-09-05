import type { EstimateTier, InvoiceStatus, Prisma, ServiceUnit } from "@crm/db";
import { INVOICES } from "./invoices.config";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AgingBucket = "current" | "due_soon" | "overdue" | null;

export function agingBucket(
	dueAt: Date | null,
	status: InvoiceStatus,
	now: Date,
): AgingBucket {
	if (status !== "SENT" || !dueAt) return null;

	const msRemaining = dueAt.getTime() - now.getTime();
	if (msRemaining < 0) return "overdue";
	if (msRemaining <= INVOICES.dueSoonDays * DAY_MS) return "due_soon";
	return "current";
}

export type EstimateLineItemLike = {
	name: string;
	unit: ServiceUnit;
	quantity: number | string | Prisma.Decimal;
	areaLabel: string | null;
	sortOrder: number;
	priceGoodCents: number;
	priceBetterCents: number;
	priceBestCents: number;
};

export type EstimateLike = {
	lineItems: EstimateLineItemLike[];
};

export type InvoiceLineItemDraft = {
	name: string;
	unit: ServiceUnit;
	quantity: number;
	priceCents: number;
	areaLabel: string | null;
	sortOrder: number;
};

const TIER_PRICE_KEY = {
	GOOD: "priceGoodCents",
	BETTER: "priceBetterCents",
	BEST: "priceBestCents",
} as const satisfies Record<EstimateTier, keyof EstimateLineItemLike>;

export function linesFromEstimate(
	estimate: EstimateLike,
	tier: EstimateTier,
): InvoiceLineItemDraft[] {
	const priceKey = TIER_PRICE_KEY[tier];

	return estimate.lineItems.map((item) => ({
		name: item.name,
		unit: item.unit,
		quantity: Number(item.quantity),
		priceCents: item[priceKey] as number,
		areaLabel: item.areaLabel,
		sortOrder: item.sortOrder,
	}));
}
