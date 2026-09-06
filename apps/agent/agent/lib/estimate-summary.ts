import { db } from "@crm/db";
import { fenceUntrusted } from "./untrusted";

export type EstimateLineItemSummary = {
	id: string;
	name: string;
	unit: string;
	quantity: number;
	priceGoodCents: number;
	priceBetterCents: number;
	priceBestCents: number;
};

export type EstimateTotals = {
	goodCents: number;
	betterCents: number;
	bestCents: number;
};

export type EstimateSummary = {
	found: true;
	estimateId: string;
	title: string;
	status: string;
	selectedTier: string;
	dealId: string | null;
	dealName: string | null;
	contactId: string | null;
	contactName: string | null;
	drawingId: string | null;
	lineItems: EstimateLineItemSummary[];
	totals: EstimateTotals;
};

export async function loadEstimateSummary(
	estimateId: string,
): Promise<EstimateSummary | { found: false; reason: string }> {
	const estimate = await db.estimate.findUnique({
		where: { id: estimateId },
		select: {
			id: true,
			title: true,
			status: true,
			selectedTier: true,
			dealId: true,
			deal: { select: { name: true } },
			contactId: true,
			contact: { select: { firstName: true, lastName: true } },
			drawingId: true,
			lineItems: {
				orderBy: { sortOrder: "asc" },
				select: {
					id: true,
					name: true,
					unit: true,
					quantity: true,
					priceGoodCents: true,
					priceBetterCents: true,
					priceBestCents: true,
				},
			},
		},
	});

	if (!estimate) return { found: false, reason: "No such estimate." };

	const totals: EstimateTotals = {
		goodCents: 0,
		betterCents: 0,
		bestCents: 0,
	};
	for (const item of estimate.lineItems) {
		const quantity = Number(item.quantity);
		totals.goodCents += Math.round(quantity * item.priceGoodCents);
		totals.betterCents += Math.round(quantity * item.priceBetterCents);
		totals.bestCents += Math.round(quantity * item.priceBestCents);
	}

	const contactName = estimate.contact
		? [estimate.contact.firstName, estimate.contact.lastName]
				.filter(Boolean)
				.join(" ")
		: null;

	return {
		found: true,
		estimateId: estimate.id,
		title: fenceUntrusted("estimate title", estimate.title),
		status: estimate.status,
		selectedTier: estimate.selectedTier,
		dealId: estimate.dealId,
		dealName: estimate.deal
			? fenceUntrusted("deal title", estimate.deal.name)
			: null,
		contactId: estimate.contactId,
		contactName: contactName
			? fenceUntrusted("contact name", contactName)
			: null,
		drawingId: estimate.drawingId,
		lineItems: estimate.lineItems.map((item) => ({
			id: item.id,
			name: fenceUntrusted("line item name", item.name),
			unit: item.unit,
			quantity: Number(item.quantity),
			priceGoodCents: item.priceGoodCents,
			priceBetterCents: item.priceBetterCents,
			priceBestCents: item.priceBestCents,
		})),
		totals,
	};
}
