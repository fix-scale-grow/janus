import { TemplatePurpose } from "@crm/db/enums";

export type TemplateLabel = {
	name: string;
	usedFor: string;
	slug: string;
};

export const TEMPLATE_LABELS: Record<TemplatePurpose, TemplateLabel> = {
	[TemplatePurpose.ESTIMATE_SEND]: {
		name: "Estimate email",
		usedFor: "Sent when an estimate goes to a contact.",
		slug: "estimate-email",
	},
	[TemplatePurpose.INVOICE_SEND]: {
		name: "Invoice email",
		usedFor: "Sent when an invoice goes to a contact.",
		slug: "invoice-email",
	},
	[TemplatePurpose.CONTRACT_SEND]: {
		name: "Contract email",
		usedFor: "Sent when a contract goes to a contact for signing.",
		slug: "contract-email",
	},
	[TemplatePurpose.CONTRACT_BODY]: {
		name: "Standard contract",
		usedFor: "The agreement text a contract is built from.",
		slug: "contract-body",
	},
};

export const TEMPLATE_PURPOSE_ORDER: TemplatePurpose[] = [
	TemplatePurpose.ESTIMATE_SEND,
	TemplatePurpose.INVOICE_SEND,
	TemplatePurpose.CONTRACT_SEND,
	TemplatePurpose.CONTRACT_BODY,
];

const SLUG_TO_PURPOSE: Record<string, TemplatePurpose> = Object.fromEntries(
	TEMPLATE_PURPOSE_ORDER.map((purpose) => [
		TEMPLATE_LABELS[purpose].slug,
		purpose,
	]),
);

export function purposeFromSlug(slug: string): TemplatePurpose | undefined {
	return SLUG_TO_PURPOSE[slug];
}
