import * as ReactPdf from "@react-pdf/renderer";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { createElement } from "react";
import { formatCents } from "../documents/pdf-money";

const renderToBuffer = (
	ReactPdf as unknown as {
		renderToBuffer: (element: ReactElement) => Promise<Buffer>;
	}
).renderToBuffer;

export type InvoicePdfLineItem = {
	name: string;
	unit: string;
	quantity: number;
	areaLabel: string | null;
	priceCents: number;
};

export type InvoicePdfContact = {
	firstName: string;
	lastName: string | null;
	email: string | null;
	phone: string | null;
};

export type InvoicePdfInvoice = {
	number: number;
	currency: string;
	issuedAt: Date | null;
	dueAt: Date | null;
	notes: string | null;
	lineItems: InvoicePdfLineItem[];
	contact: InvoicePdfContact | null;
};

const GENERAL_GROUP = "General";

const UNIT_LABELS: Record<string, string> = {
	PER_SQUARE: "sq",
	PER_LINEAR_FT: "lin ft",
	PER_EACH: "each",
	FLAT: "flat",
};

export function invoiceTotalCents(lineItems: InvoicePdfLineItem[]): number {
	return lineItems.reduce(
		(sum, item) => sum + Math.round(item.quantity * item.priceCents),
		0,
	);
}

function groupByArea(
	lineItems: InvoicePdfLineItem[],
): [string, InvoicePdfLineItem[]][] {
	const groups = new Map<string, InvoicePdfLineItem[]>();
	const general: InvoicePdfLineItem[] = [];

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
	invoiceLabel: {
		fontSize: 10,
		color: "#666666",
		textAlign: "right",
	},
	title: {
		fontSize: 18,
		fontFamily: "Helvetica-Bold",
		marginBottom: 4,
	},
	dates: {
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
	totalDueRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		alignItems: "baseline",
		gap: 12,
		marginTop: 28,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#cccccc",
	},
	totalDueLabel: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
	},
	totalDueValue: {
		fontSize: 16,
		fontFamily: "Helvetica-Bold",
	},
	notes: {
		marginTop: 20,
	},
	notesLabel: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: "#666666",
		marginBottom: 4,
	},
});

function contactName(contact: InvoicePdfContact): string {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

export async function renderInvoicePdf(
	invoice: InvoicePdfInvoice,
	workspaceName: string,
): Promise<Buffer> {
	const total = invoiceTotalCents(invoice.lineItems);
	const groups = groupByArea(invoice.lineItems);

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
						formatCents(item.priceCents, invoice.currency),
					),
					createElement(
						Text,
						{ style: styles.colTotal },
						formatCents(
							Math.round(item.quantity * item.priceCents),
							invoice.currency,
						),
					),
				),
			),
		),
	);

	const totalDueRow = createElement(
		View,
		{ style: styles.totalDueRow },
		createElement(Text, { style: styles.totalDueLabel }, "Total due"),
		createElement(
			Text,
			{ style: styles.totalDueValue },
			formatCents(total, invoice.currency),
		),
	);

	const contactBlock = invoice.contact
		? createElement(
				View,
				{ style: styles.contactBlock },
				createElement(Text, { style: styles.contactLabel }, "Billed to"),
				createElement(
					Text,
					{ style: styles.contactName },
					contactName(invoice.contact),
				),
				invoice.contact.email
					? createElement(Text, {}, invoice.contact.email)
					: null,
				invoice.contact.phone
					? createElement(Text, {}, invoice.contact.phone)
					: null,
			)
		: null;

	const notesBlock = invoice.notes
		? createElement(
				View,
				{ style: styles.notes },
				createElement(Text, { style: styles.notesLabel }, "Notes"),
				createElement(Text, {}, invoice.notes),
			)
		: null;

	const dateParts = [
		invoice.issuedAt ? `Issued ${invoice.issuedAt.toLocaleDateString()}` : null,
		invoice.dueAt ? `Due ${invoice.dueAt.toLocaleDateString()}` : null,
	].filter(Boolean);

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
				createElement(Text, { style: styles.invoiceLabel }, "Invoice"),
			),
			createElement(
				Text,
				{ style: styles.title },
				`Invoice #${invoice.number}`,
			),
			dateParts.length > 0
				? createElement(Text, { style: styles.dates }, dateParts.join("  •  "))
				: null,
			contactBlock,
			...rows,
			totalDueRow,
			notesBlock,
		),
	);

	return renderToBuffer(document);
}
