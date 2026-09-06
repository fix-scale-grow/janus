import { db } from "@crm/db";
import { parseServiceModifier } from "@crm/drawings";

export type PriceBookModifier = {
	label: string;
	options: { name: string; factor: number }[];
};

export type PriceBookEntry = {
	id: string;
	name: string;
	unit: string;
	unitPriceCents: number;
	priceGoodCents: number | null;
	priceBestCents: number | null;
	modifier: PriceBookModifier | null;
	symbol: string | null;
};

export async function listPriceBook(trade?: string): Promise<PriceBookEntry[]> {
	const rows = await db.service.findMany({
		where: { active: true, ...(trade ? { trade } : {}) },
		orderBy: { name: "asc" },
		include: { symbols: { select: { name: true }, take: 1 } },
	});

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		unit: row.unit,
		unitPriceCents: row.unitPriceCents,
		priceGoodCents: row.priceGoodCents,
		priceBestCents: row.priceBestCents,
		modifier: parseServiceModifier(row.modifier),
		symbol: row.symbols[0]?.name ?? null,
	}));
}
