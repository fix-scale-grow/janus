import type { PermitType } from "@crm/db";
import { PERMIT_DISCLAIMER } from "@crm/db/permits";
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

export type PermitPdfField = {
	label: string;
	value: string;
};

export type PermitPdfChecklistItem = {
	label: string;
	attached: boolean;
};

export type PermitPdfInspection = {
	name: string;
	scheduledFor: Date | null;
	result: string;
};

export const PERMIT_TYPE_LABEL: Record<PermitType, string> = {
	BUILDING: "Building permit",
	ROOFING: "Roofing permit",
	ELECTRICAL: "Electrical permit",
	PLUMBING: "Plumbing permit",
	MECHANICAL: "Mechanical permit",
	OTHER: "Permit",
};

export type PermitPdfInput = {
	workspaceName: string;
	accentColor: string;
	permitTypeLabel: string;
	jurisdictionName: string;
	jurisdictionState: string;
	dealName: string;
	dealNumber: number;
	permitNumber: string | null;
	feeCents: number | null;
	currency: string;
	fields: PermitPdfField[];
	checklist: PermitPdfChecklistItem[];
	inspections: PermitPdfInspection[];
};

const styles = StyleSheet.create({
	page: {
		padding: 40,
		paddingBottom: 70,
		fontSize: 10,
		fontFamily: "Helvetica",
		color: "#111111",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 16,
	},
	workspaceName: {
		fontSize: 16,
		fontFamily: "Helvetica-Bold",
	},
	docLabel: {
		fontSize: 10,
		color: "#666666",
		textAlign: "right",
	},
	title: {
		fontSize: 18,
		fontFamily: "Helvetica-Bold",
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 10,
		color: "#666666",
		marginBottom: 2,
	},
	metaBlock: {
		marginTop: 12,
		marginBottom: 20,
		padding: 10,
		backgroundColor: "#f5f5f5",
	},
	metaRow: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	sectionHeading: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		marginTop: 18,
		marginBottom: 8,
	},
	fieldRow: {
		flexDirection: "row",
		paddingVertical: 3,
		borderBottomWidth: 0.5,
		borderBottomColor: "#eeeeee",
	},
	fieldLabel: { flex: 1, color: "#666666" },
	fieldValue: { flex: 1 },
	checklistRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 3,
		borderBottomWidth: 0.5,
		borderBottomColor: "#eeeeee",
	},
	checklistLabel: { flex: 1 },
	checklistStatus: { width: 80, textAlign: "right" },
	checklistStatusAttached: { color: "#0a7a3d" },
	checklistStatusMissing: { color: "#b42318" },
	inspectionRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 3,
		borderBottomWidth: 0.5,
		borderBottomColor: "#eeeeee",
	},
	inspectionName: { flex: 1.4 },
	inspectionDate: { flex: 1, textAlign: "right" },
	inspectionResult: { flex: 1, textAlign: "right" },
	footer: {
		position: "absolute",
		bottom: 24,
		left: 40,
		right: 40,
		fontSize: 8,
		color: "#666666",
	},
});

function formatDate(value: Date | null): string {
	return value ? value.toLocaleDateString() : "";
}

export async function renderPermitWorksheetPdf(
	input: PermitPdfInput,
): Promise<Buffer> {
	const fieldRows = input.fields.map((field) =>
		createElement(
			View,
			{ key: field.label, style: styles.fieldRow },
			createElement(Text, { style: styles.fieldLabel }, field.label),
			createElement(Text, { style: styles.fieldValue }, field.value),
		),
	);

	const checklistRows = input.checklist.map((item) =>
		createElement(
			View,
			{ key: item.label, style: styles.checklistRow },
			createElement(Text, { style: styles.checklistLabel }, item.label),
			createElement(
				Text,
				{
					style: [
						styles.checklistStatus,
						item.attached
							? styles.checklistStatusAttached
							: styles.checklistStatusMissing,
					],
				},
				item.attached ? "Attached" : "Missing",
			),
		),
	);

	const inspectionsSection =
		input.inspections.length > 0
			? createElement(
					View,
					{},
					createElement(Text, { style: styles.sectionHeading }, "Inspections"),
					...input.inspections.map((inspection) =>
						createElement(
							View,
							{ key: inspection.name, style: styles.inspectionRow },
							createElement(
								Text,
								{ style: styles.inspectionName },
								inspection.name,
							),
							createElement(
								Text,
								{ style: styles.inspectionDate },
								formatDate(inspection.scheduledFor),
							),
							createElement(
								Text,
								{ style: styles.inspectionResult },
								inspection.result,
							),
						),
					),
				)
			: null;

	const feeRow =
		input.feeCents !== null
			? createElement(
					View,
					{ style: styles.metaRow },
					createElement(Text, {}, "Fee"),
					createElement(Text, {}, formatCents(input.feeCents, input.currency)),
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
				createElement(
					Text,
					{ style: styles.workspaceName },
					input.workspaceName,
				),
				createElement(
					Text,
					{ style: styles.docLabel },
					"Application worksheet",
				),
			),
			createElement(
				Text,
				{ style: [styles.title, { color: input.accentColor }] },
				input.permitTypeLabel,
			),
			createElement(
				Text,
				{ style: styles.subtitle },
				`${input.jurisdictionName}, ${input.jurisdictionState}`,
			),
			createElement(
				Text,
				{ style: styles.subtitle },
				`${input.dealName} · #${input.dealNumber}`,
			),
			createElement(
				View,
				{ style: styles.metaBlock },
				createElement(
					View,
					{ style: styles.metaRow },
					createElement(Text, {}, "Permit number"),
					createElement(Text, {}, input.permitNumber ?? ""),
				),
				feeRow,
			),
			createElement(Text, { style: styles.sectionHeading }, "Worksheet"),
			...fieldRows,
			createElement(Text, { style: styles.sectionHeading }, "Checklist"),
			...checklistRows,
			inspectionsSection,
			createElement(
				Text,
				{ style: styles.footer, fixed: true },
				PERMIT_DISCLAIMER,
			),
		),
	);

	return renderToBuffer(document);
}
