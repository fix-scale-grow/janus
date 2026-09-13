import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { createElement } from "react";

export type PdfTextBlocks = {
	introNote: string | null;
	scopeOfWork: string | null;
	terms: string | null;
};

const styles = StyleSheet.create({
	heading: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		marginTop: 16,
		marginBottom: 4,
	},
	body: {
		fontSize: 10,
		lineHeight: 1.5,
	},
	introBody: {
		fontSize: 10,
		lineHeight: 1.5,
		marginTop: 12,
	},
	termsHeading: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
		marginTop: 20,
		marginBottom: 3,
	},
	termsBody: {
		fontSize: 8,
		lineHeight: 1.5,
		color: "#444444",
	},
});

export function textBlockSections(text: PdfTextBlocks) {
	const intro = text.introNote?.trim()
		? createElement(Text, { style: styles.introBody }, text.introNote.trim())
		: null;
	const scope = text.scopeOfWork?.trim()
		? createElement(
				View,
				{},
				createElement(Text, { style: styles.heading }, "Scope of work"),
				createElement(Text, { style: styles.body }, text.scopeOfWork.trim()),
			)
		: null;
	const terms = text.terms?.trim()
		? createElement(
				View,
				{},
				createElement(Text, { style: styles.termsHeading }, "Terms"),
				createElement(Text, { style: styles.termsBody }, text.terms.trim()),
			)
		: null;
	return { intro, scope, terms };
}
