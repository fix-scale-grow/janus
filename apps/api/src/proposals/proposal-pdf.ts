import type { EstimateTier } from "@crm/db";
import * as ReactPdf from "@react-pdf/renderer";
import {
	Document,
	Image,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { createElement } from "react";
import { pdfChromeElements, renderBodyBlocks } from "../contracts/contract-pdf";
import {
	DEFAULT_DOCUMENT_CHROME,
	type DocumentChrome,
} from "../documents/document-chrome";
import { formatCents } from "../documents/pdf-money";
import {
	type EstimatePdfLineItem,
	TIER_LABEL,
	tierTotals,
} from "../estimates/estimate-pdf";
import type { TemplateBlocks } from "../templates/template-blocks";

const renderToBuffer = (
	ReactPdf as unknown as {
		renderToBuffer: (element: ReactElement) => Promise<Buffer>;
	}
).renderToBuffer;

export type ProposalPdfPhoto = { filename: string; dataUrl: string };

export type ProposalPdfInput = {
	number: number;
	title: string;
	coverTitle: string | null;
	coverSubtitle: string | null;
	contactName: string | null;
	currency: string;
	selectedTier: EstimateTier;
	acceptedTier: EstimateTier | null;
	lineItems: EstimatePdfLineItem[];
	body: TemplateBlocks;
	context: Record<string, string>;
	photos: ProposalPdfPhoto[];
	createdAt: Date;
	accentColor?: string;
	chrome?: DocumentChrome;
};

const TIER_ORDER: EstimateTier[] = ["GOOD", "BETTER", "BEST"];

const TIER_PRICE_FIELD: Record<
	EstimateTier,
	"priceGoodCents" | "priceBetterCents" | "priceBestCents"
> = {
	GOOD: "priceGoodCents",
	BETTER: "priceBetterCents",
	BEST: "priceBestCents",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const styles = StyleSheet.create({
	page: {
		paddingTop: 84,
		paddingBottom: 56,
		paddingHorizontal: 40,
		fontSize: 10,
		fontFamily: "Helvetica",
		color: "#111111",
	},
	cover: {
		marginBottom: 32,
	},
	workspaceName: {
		fontSize: 12,
		color: "#666666",
		marginBottom: 24,
	},
	coverTitle: {
		fontSize: 26,
		fontFamily: "Helvetica-Bold",
		marginBottom: 6,
	},
	coverSubtitle: {
		fontSize: 12,
		color: "#444444",
		marginBottom: 16,
	},
	coverMeta: {
		fontSize: 10,
		color: "#666666",
	},
	pricingHeading: {
		fontSize: 14,
		fontFamily: "Helvetica-Bold",
		marginTop: 24,
		marginBottom: 8,
	},
	tierRow: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 16,
	},
	tierCell: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#dddddd",
		borderRadius: 4,
		padding: 10,
	},
	tierCellSelected: {
		flex: 1,
		borderWidth: 2,
		borderColor: "#111111",
		borderRadius: 4,
		padding: 10,
	},
	tierName: {
		fontSize: 10,
		color: "#666666",
		marginBottom: 4,
	},
	tierTotal: {
		fontSize: 14,
		fontFamily: "Helvetica-Bold",
	},
	itemRow: {
		flexDirection: "row",
		paddingVertical: 3,
		borderBottomWidth: 0.5,
		borderBottomColor: "#eeeeee",
	},
	itemName: { flex: 1 },
	itemQty: { width: 60, textAlign: "right", color: "#666666" },
	itemPrice: { width: 90, textAlign: "right" },
	photosHeading: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		marginTop: 20,
		marginBottom: 8,
	},
	photosGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: "4%",
	},
	photoCell: {
		width: "48%",
		marginBottom: 12,
	},
	photo: {
		width: "100%",
		objectFit: "contain",
	},
});

export async function renderProposalPdf(
	proposal: ProposalPdfInput,
	workspaceName: string,
): Promise<Buffer> {
	const totals = tierTotals(proposal.lineItems);
	const highlighted = proposal.acceptedTier ?? proposal.selectedTier;

	const cover = createElement(
		View,
		{ style: styles.cover },
		createElement(
			Text,
			{ style: styles.coverTitle },
			proposal.coverTitle?.trim() || proposal.title,
		),
		proposal.coverSubtitle?.trim()
			? createElement(
					Text,
					{ style: styles.coverSubtitle },
					proposal.coverSubtitle.trim(),
				)
			: null,
		createElement(
			Text,
			{ style: styles.coverMeta },
			[
				proposal.contactName ? `Prepared for ${proposal.contactName}` : null,
				DATE_FORMAT.format(proposal.createdAt),
				`Proposal #${proposal.number}`,
			]
				.filter(Boolean)
				.join("  •  "),
		),
	);

	const bodyElements = renderBodyBlocks(proposal.body, proposal.context);

	const pricing = createElement(
		View,
		{},
		createElement(Text, { style: styles.pricingHeading }, "Your options"),
		createElement(
			View,
			{ style: styles.tierRow },
			...TIER_ORDER.map((tier) =>
				createElement(
					View,
					{
						key: tier,
						style:
							tier === highlighted ? styles.tierCellSelected : styles.tierCell,
					},
					createElement(Text, { style: styles.tierName }, TIER_LABEL[tier]),
					createElement(
						Text,
						{ style: styles.tierTotal },
						formatCents(totals[tier], proposal.currency),
					),
				),
			),
		),
		...proposal.lineItems.map((item, index) =>
			createElement(
				View,
				{ key: `${item.name}-${index}`, style: styles.itemRow },
				createElement(Text, { style: styles.itemName }, item.name),
				createElement(Text, { style: styles.itemQty }, String(item.quantity)),
				createElement(
					Text,
					{ style: styles.itemPrice },
					formatCents(
						Math.round(item.quantity * item[TIER_PRICE_FIELD[highlighted]]),
						proposal.currency,
					),
				),
			),
		),
	);

	const photosSection =
		proposal.photos.length > 0
			? createElement(
					View,
					{},
					createElement(Text, { style: styles.photosHeading }, "Photos"),
					createElement(
						View,
						{ style: styles.photosGrid },
						...proposal.photos.map((photo, index) =>
							createElement(
								View,
								{ key: `${photo.filename}-${index}`, style: styles.photoCell },
								createElement(Image, {
									style: styles.photo,
									src: photo.dataUrl,
								}),
							),
						),
					),
				)
			: null;

	const chrome = pdfChromeElements({
		label: `Proposal #${proposal.number}`,
		accentColor: proposal.accentColor ?? "#006b4f",
		chrome: proposal.chrome ?? DEFAULT_DOCUMENT_CHROME,
		context: proposal.context,
	});

	const document = createElement(
		Document,
		{},
		createElement(
			Page,
			{ size: "LETTER", style: styles.page },
			chrome.header,
			chrome.footer,
			cover,
			...bodyElements,
			pricing,
			photosSection,
		),
	);

	return renderToBuffer(document);
}
