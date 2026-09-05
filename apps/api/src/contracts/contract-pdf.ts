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
};

const NUMBER_PAD_LENGTH = 4;

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

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
});

function stripTags(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|h[1-6])>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.trim();
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
	}
}

function renderSignatureSection(
	signature: ContractPdfSignature | undefined,
): ReactElement {
	if (!signature) {
		return createElement(
			View,
			{ style: styles.signatureBlock },
			createElement(
				Text,
				{ style: styles.unsignedPlaceholder },
				"Not yet signed.",
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
		{ style: styles.signatureBlock },
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

	const bodyElements = input.bodyHtmlBlocks
		.map((block, index) => renderBodyBlock(block, input.context, index))
		.filter((element): element is ReactElement => element !== null);

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
				createElement(Text, { style: styles.contractLabel }, contractLabel),
			),
			createElement(Text, { style: styles.title }, input.title),
			createElement(
				Text,
				{ style: styles.date },
				DATE_FORMAT.format(new Date()),
			),
			...bodyElements,
			renderSignatureSection(input.signature),
		),
	);

	return renderToBuffer(document);
}
