import type { EstimateTier } from "@crm/db";
import * as ReactPdf from "@react-pdf/renderer";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { createElement } from "react";

const renderToBuffer = (
	ReactPdf as unknown as {
		renderToBuffer: (element: ReactElement) => Promise<Buffer>;
	}
).renderToBuffer;

export type EstimatePdfLineItem = {
	name: string;
	unit: string;
	quantity: number;
	areaLabel: string | null;
	priceGoodCents: number;
	priceBetterCents: number;
	priceBestCents: number;
};

export type EstimatePdfContact = {
	firstName: string;
	lastName: string | null;
	email: string | null;
	phone: string | null;
};

export type EstimatePdfEstimate = {
	title: string;
	currency: string;
	selectedTier: EstimateTier;
	createdAt: Date;
	lineItems: EstimatePdfLineItem[];
	contact: EstimatePdfContact | null;
};

const GENERAL_GROUP = "General";

const UNIT_LABELS: Record<string, string> = {
	PER_SQUARE: "sq",
	PER_LINEAR_FT: "lin ft",
	PER_EACH: "each",
	FLAT: "flat",
};

const TIER_PRICE_FIELD: Record<
	EstimateTier,
	"priceGoodCents" | "priceBetterCents" | "priceBestCents"
> = {
	GOOD: "priceGoodCents",
	BETTER: "priceBetterCents",
	BEST: "priceBestCents",
};

const TIER_LABEL: Record<EstimateTier, string> = {
	GOOD: "Good",
	BETTER: "Better",
	BEST: "Best",
};

const TIER_ORDER: EstimateTier[] = ["GOOD", "BETTER", "BEST"];

function formatCents(cents: number, currency: string): string {
	const code = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : "USD";

	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: code,
		}).format(cents / 100);
	} catch {
		return `${code} ${(cents / 100).toFixed(2)}`;
	}
}

function tierTotals(
	lineItems: EstimatePdfLineItem[],
): Record<EstimateTier, number> {
	const totals: Record<EstimateTier, number> = {
		GOOD: 0,
		BETTER: 0,
		BEST: 0,
	};

	for (const item of lineItems) {
		for (const tier of TIER_ORDER) {
			totals[tier] += Math.round(item.quantity * item[TIER_PRICE_FIELD[tier]]);
		}
	}

	return totals;
}

function groupByArea(
	lineItems: EstimatePdfLineItem[],
): [string, EstimatePdfLineItem[]][] {
	const groups = new Map<string, EstimatePdfLineItem[]>();
	const general: EstimatePdfLineItem[] = [];

	for (const item of lineItems) {
		if (!item.areaLabel) {
			general.push(item);
			continue;
		}
		const list = groups.get(item.areaLabel) ?? [];
		list.push(item);
		groups.set(item.areaLabel, list);
	}

	const entries = Array.from(groups.entries());
	if (general.length > 0 || entries.length === 0) {
		entries.push([GENERAL_GROUP, general]);
	}
	return entries;
}

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontSize: 10,
		fontFamily: "Helvetica",
		color: "#111111",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 24,
	},
	workspaceName: {
		fontSize: 16,
		fontFamily: "Helvetica-Bold",
	},
	estimateLabel: {
		fontSize: 10,
		color: "#666666",
		textAlign: "right",
	},
	title: {
		fontSize: 18,
		fontFamily: "Helvetica-Bold",
		marginBottom: 4,
	},
	date: {
		fontSize: 10,
		color: "#666666",
		marginBottom: 16,
	},
	contactBlock: {
		marginBottom: 20,
		padding: 10,
		backgroundColor: "#f5f5f5",
	},
	contactLabel: {
		fontSize: 9,
		color: "#666666",
		marginBottom: 2,
	},
	contactName: {
		fontSize: 11,
		fontFamily: "Helvetica-Bold",
	},
	areaHeading: {
		fontSize: 11,
		fontFamily: "Helvetica-Bold",
		marginTop: 14,
		marginBottom: 6,
	},
	tableHeaderRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#cccccc",
		paddingBottom: 4,
		marginBottom: 2,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 3,
		borderBottomWidth: 0.5,
		borderBottomColor: "#eeeeee",
	},
	colName: { flex: 3 },
	colQty: { flex: 1, textAlign: "right", paddingRight: 6 },
	colUnit: { flex: 1 },
	colUnitPrice: { flex: 1.2, textAlign: "right" },
	colTotal: { flex: 1.2, textAlign: "right" },
	headerCell: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: "#666666",
	},
	optionsStrip: {
		flexDirection: "row",
		justifyContent: "center",
		gap: 16,
		marginTop: 28,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#cccccc",
	},
	optionItem: {
		fontSize: 10,
	},
	optionItemSelected: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
	},
});

function contactName(contact: EstimatePdfContact): string {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

export async function renderEstimatePdf(
	estimate: EstimatePdfEstimate,
	workspaceName: string,
): Promise<Buffer> {
	const totals = tierTotals(estimate.lineItems);
	const priceField = TIER_PRICE_FIELD[estimate.selectedTier];
	const groups = groupByArea(estimate.lineItems);

	const rows = groups.map(([areaLabel, items]) =>
		createElement(
			View,
			{ key: areaLabel },
			createElement(Text, { style: styles.areaHeading }, areaLabel),
			createElement(
				View,
				{ style: styles.tableHeaderRow },
				createElement(
					Text,
					{ style: [styles.colName, styles.headerCell] },
					"Item",
				),
				createElement(
					Text,
					{ style: [styles.colQty, styles.headerCell] },
					"Qty",
				),
				createElement(
					Text,
					{ style: [styles.colUnit, styles.headerCell] },
					"Unit",
				),
				createElement(
					Text,
					{ style: [styles.colUnitPrice, styles.headerCell] },
					"Unit price",
				),
				createElement(
					Text,
					{ style: [styles.colTotal, styles.headerCell] },
					"Total",
				),
			),
			...items.map((item) =>
				createElement(
					View,
					{
						key: `${areaLabel}-${item.name}-${item.quantity}`,
						style: styles.tableRow,
					},
					createElement(Text, { style: styles.colName }, item.name),
					createElement(Text, { style: styles.colQty }, String(item.quantity)),
					createElement(
						Text,
						{ style: styles.colUnit },
						UNIT_LABELS[item.unit] ?? item.unit,
					),
					createElement(
						Text,
						{ style: styles.colUnitPrice },
						formatCents(item[priceField], estimate.currency),
					),
					createElement(
						Text,
						{ style: styles.colTotal },
						formatCents(
							Math.round(item.quantity * item[priceField]),
							estimate.currency,
						),
					),
				),
			),
		),
	);

	const optionsStrip = createElement(
		View,
		{ style: styles.optionsStrip },
		...TIER_ORDER.map((tier) =>
			createElement(
				Text,
				{
					key: tier,
					style:
						tier === estimate.selectedTier
							? styles.optionItemSelected
							: styles.optionItem,
				},
				`${TIER_LABEL[tier]} ${formatCents(totals[tier], estimate.currency)}`,
			),
		),
	);

	const contactBlock = estimate.contact
		? createElement(
				View,
				{ style: styles.contactBlock },
				createElement(Text, { style: styles.contactLabel }, "Prepared for"),
				createElement(
					Text,
					{ style: styles.contactName },
					contactName(estimate.contact),
				),
				estimate.contact.email
					? createElement(Text, {}, estimate.contact.email)
					: null,
				estimate.contact.phone
					? createElement(Text, {}, estimate.contact.phone)
					: null,
			)
		: null;

	const document = createElement(
		Document,
		{},
		createElement(
			Page,
			{ size: "LETTER", style: styles.page },
			createElement(
				View,
				{ style: styles.header },
				createElement(Text, { style: styles.workspaceName }, workspaceName),
				createElement(Text, { style: styles.estimateLabel }, "Estimate"),
			),
			createElement(Text, { style: styles.title }, estimate.title),
			createElement(
				Text,
				{ style: styles.date },
				estimate.createdAt.toLocaleDateString(),
			),
			contactBlock,
			...rows,
			optionsStrip,
		),
	);

	return renderToBuffer(document);
}
