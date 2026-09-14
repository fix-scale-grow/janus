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
import {
	DEFAULT_DOCUMENT_CHROME,
	type DocumentChrome,
} from "../documents/document-chrome";
import { applyMergeFields } from "../templates/render-email";
import type { TemplateBlocks } from "../templates/template-blocks";

const renderToBuffer = (
	ReactPdf as unknown as {
		renderToBuffer: (element: ReactElement) => Promise<Buffer>;
	}
).renderToBuffer;

export type ContractPdfSignature = {
	kind: "typed" | "drawn";
	data: string;
	signerName: string;
	signedAt: Date;
};

export type ContractPdfInput = {
	title: string;
	number: number;
	bodyHtmlBlocks: TemplateBlocks;
	context: Record<string, string>;
	signature?: ContractPdfSignature;
	accentColor?: string;
	chrome?: DocumentChrome;
};

export type PdfChrome = {
	label: string;
	accentColor: string;
	chrome: DocumentChrome;
	context: Record<string, string>;
};

const DEFAULT_ACCENT = "#006b4f";

export function pdfChromeElements(input: PdfChrome): {
	header: ReactElement;
	footer: ReactElement;
} {
	const headerElements = renderBodyBlocks(
		input.chrome.headerBlocks,
		input.context,
	);
	const footerElements = renderBodyBlocks(
		input.chrome.footerBlocks,
		input.context,
	);

	const header = createElement(
		View,
		{ fixed: true, style: chromeStyles.band },
		createElement(View, {
			style: [chromeStyles.accentBar, { backgroundColor: input.accentColor }],
		}),
		createElement(
			View,
			{ style: chromeStyles.bandRow },
			createElement(View, { style: chromeStyles.bandLeft }, ...headerElements),
			createElement(Text, { style: chromeStyles.bandLabel }, input.label),
		),
	);

	const footer = createElement(
		View,
		{ fixed: true, style: chromeStyles.footer },
		createElement(View, { style: chromeStyles.footerLeft }, ...footerElements),
		createElement(Text, {
			style: chromeStyles.footerText,
			render: ({
				pageNumber,
				totalPages,
			}: {
				pageNumber: number;
				totalPages: number;
			}) => `Page ${pageNumber} of ${totalPages}`,
		}),
	);

	return { header, footer };
}

const chromeStyles = StyleSheet.create({
	band: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
	},
	accentBar: {
		height: 6,
	},
	bandRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
		paddingHorizontal: 40,
		paddingTop: 16,
		paddingBottom: 10,
		borderBottomWidth: 0.5,
		borderBottomColor: "#dddddd",
	},
	bandLeft: {
		flexDirection: "column",
		flexShrink: 1,
	},
	bandLabel: {
		fontSize: 9,
		color: "#666666",
	},
	footer: {
		position: "absolute",
		bottom: 18,
		left: 40,
		right: 40,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
	},
	footerLeft: {
		flexDirection: "column",
		gap: 2,
	},
	footerText: {
		fontSize: 8,
		color: "#999999",
	},
});

const NUMBER_PAD_LENGTH = 4;

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
	contractLabel: {
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
		marginBottom: 20,
	},
	heading: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		marginTop: 14,
		marginBottom: 6,
	},
	text: {
		fontSize: 10,
		lineHeight: 1.5,
		marginBottom: 4,
	},
	buttonLabel: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
		marginBottom: 4,
	},
	divider: {
		borderBottomWidth: 1,
		borderBottomColor: "#cccccc",
		marginVertical: 10,
	},
	signatureBlock: {
		marginTop: 32,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#cccccc",
	},
	typedSignature: {
		fontSize: 22,
		fontFamily: "Helvetica-Oblique",
		marginBottom: 6,
	},
	signatureImage: {
		width: 220,
		height: 80,
		marginBottom: 6,
		objectFit: "contain",
	},
	signatureLine: {
		fontSize: 9,
		color: "#666666",
	},
	unsignedPlaceholder: {
		fontSize: 9,
		color: "#999999",
	},
	signHereLine: {
		fontSize: 12,
		color: "#999999",
		borderBottomWidth: 1,
		borderBottomColor: "#999999",
		width: 260,
		paddingBottom: 14,
		marginBottom: 4,
	},
});

function stripTags(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|h[1-6])>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.trim();
}

export function renderBodyBlocks(
	blocks: TemplateBlocks,
	context: Record<string, string>,
): ReactElement[] {
	return blocks
		.map((block, index) => renderBodyBlock(block, context, index))
		.filter((element): element is ReactElement => element !== null);
}

function renderBodyBlock(
	block: TemplateBlocks[number],
	context: Record<string, string>,
	key: number,
): ReactElement | null {
	switch (block.kind) {
		case "heading":
			return createElement(
				Text,
				{ key, style: styles.heading },
				applyMergeFields(block.text, context),
			);
		case "text":
			return createElement(
				Text,
				{ key, style: styles.text },
				applyMergeFields(stripTags(block.html), context),
			);
		case "button":
			return createElement(
				Text,
				{ key, style: styles.buttonLabel },
				applyMergeFields(block.label, context),
			);
		case "divider":
			return createElement(View, { key, style: styles.divider });
		case "spacer":
			return createElement(View, { key, style: { height: block.height } });
		case "logo":
			return null;
		case "signature":
			return null;
		case "pageBreak":
			return createElement(View, { key, break: true });
	}
}

function renderSignatureSection(
	signature: ContractPdfSignature | undefined,
	key?: number,
): ReactElement {
	if (!signature) {
		return createElement(
			View,
			{ key, style: styles.signatureBlock },
			createElement(Text, { style: styles.signHereLine }, "X"),
			createElement(
				Text,
				{ style: styles.signatureLine },
				"Signature                                          Date",
			),
		);
	}

	const mark =
		signature.kind === "typed"
			? createElement(Text, { style: styles.typedSignature }, signature.data)
			: createElement(Image, {
					style: styles.signatureImage,
					src: signature.data,
				});

	return createElement(
		View,
		{ key, style: styles.signatureBlock },
		mark,
		createElement(
			Text,
			{ style: styles.signatureLine },
			`${signature.signerName} · signed ${DATE_FORMAT.format(signature.signedAt)}`,
		),
	);
}

export async function renderContractPdf(
	input: ContractPdfInput,
	workspaceName: string,
): Promise<Buffer> {
	const contractLabel = `C-${String(input.number).padStart(NUMBER_PAD_LENGTH, "0")}`;
	const hasSignatureBlock = input.bodyHtmlBlocks.some(
		(block) => block.kind === "signature",
	);

	const bodyElements = input.bodyHtmlBlocks
		.map((block, index) =>
			block.kind === "signature"
				? renderSignatureSection(input.signature, index)
				: renderBodyBlock(block, input.context, index),
		)
		.filter((element): element is ReactElement => element !== null);

	const chrome = pdfChromeElements({
		label: contractLabel,
		accentColor: input.accentColor ?? DEFAULT_ACCENT,
		chrome: input.chrome ?? DEFAULT_DOCUMENT_CHROME,
		context: input.context,
	});

	const document = createElement(
		Document,
		{},
		createElement(
			Page,
			{ size: "LETTER", style: styles.page },
			chrome.header,
			chrome.footer,
			createElement(Text, { style: styles.title }, input.title),
			createElement(
				Text,
				{ style: styles.date },
				DATE_FORMAT.format(new Date()),
			),
			...bodyElements,
			hasSignatureBlock ? null : renderSignatureSection(input.signature),
		),
	);

	return renderToBuffer(document);
}
