import { TemplatePurpose, TemplateType } from "@crm/db";
import type { TemplateBlocks } from "./template-blocks";

export const TEMPLATE_BLOCKS = {
	heading: { maxTextLength: 300 },
	text: {
		maxHtmlLength: 8000,
		allowedTags: ["b", "i", "strong", "em", "br", "a", "span"],
		allowedHrefSchemes: ["http:", "https:", "mailto:"],
	},
	button: { maxLabelLength: 80 },
	spacer: { minHeight: 4, maxHeight: 96 },
} as const;

export const EMAIL_RENDER = {
	tableWidth: 600,
	cellPadding: "24px 32px",
	brandGreen: "#006b4f",
	logoSize: 44,
} as const;

export const MERGE_FIELDS = {
	contact: ["contact.full_name", "contact.first_name", "contact.email"],
	business: ["business.name", "business.phone", "sender.name"],
	deal: ["deal.title", "deal.address"],
	estimate: ["estimate.title", "estimate.total", "estimate.tier"],
	invoice: ["invoice.number", "invoice.total", "invoice.due_date"],
	contract: ["contract.number", "contract.title"],
	send: ["signing_link", "personal_note"],
} as const;

export type MergeFieldToken =
	(typeof MERGE_FIELDS)[keyof typeof MERGE_FIELDS][number];

export type StaticMergeField = { token: string; label: string };

export type StaticMergeFieldGroup = {
	id: string;
	label: string;
	fields: StaticMergeField[];
};

export const STATIC_MERGE_FIELD_GROUPS: StaticMergeFieldGroup[] = [
	{
		id: "contact",
		label: "Contact",
		fields: [
			{ token: "contact.full_name", label: "Full name" },
			{ token: "contact.first_name", label: "First name" },
			{ token: "contact.email", label: "Email address" },
		],
	},
	{
		id: "business",
		label: "Business",
		fields: [
			{ token: "business.name", label: "Business name" },
			{ token: "sender.name", label: "Sender name" },
		],
	},
	{
		id: "deal",
		label: "Job",
		fields: [
			{ token: "deal.title", label: "Job title" },
			{ token: "deal.address", label: "Job address" },
		],
	},
	{
		id: "estimate",
		label: "Estimate",
		fields: [
			{ token: "estimate.title", label: "Estimate title" },
			{ token: "estimate.total", label: "Total price" },
			{ token: "estimate.tier", label: "Estimate tier" },
		],
	},
	{
		id: "invoice",
		label: "Invoice",
		fields: [
			{ token: "invoice.number", label: "Invoice number" },
			{ token: "invoice.total", label: "Amount due" },
			{ token: "invoice.due_date", label: "Due date" },
		],
	},
	{
		id: "contract",
		label: "Contract",
		fields: [
			{ token: "contract.number", label: "Contract number" },
			{ token: "contract.title", label: "Contract title" },
		],
	},
	{
		id: "send",
		label: "Sending",
		fields: [
			{ token: "signing_link", label: "Signing link" },
			{ token: "personal_note", label: "Personal note" },
		],
	},
];

export const SAMPLE_MERGE_CONTEXT: Record<MergeFieldToken, string> = {
	"contact.full_name": "Jane Homeowner",
	"contact.first_name": "Jane",
	"contact.email": "jane@example.com",
	"business.name": "Fix Scale Grow Roofing",
	"business.phone": "(555) 123-4567",
	"sender.name": "Alex Rivera",
	"deal.title": "New roof replacement",
	"deal.address": "123 Main St, Springfield",
	"estimate.title": "Roof replacement estimate",
	"estimate.total": "$12,450.00",
	"estimate.tier": "Better",
	"invoice.number": "1042",
	"invoice.total": "$12,450.00",
	"invoice.due_date": "September 20, 2026",
	"contract.number": "204",
	"contract.title": "Roof replacement agreement",
	signing_link: "https://app.example.com/sign/abc123",
	personal_note: "Thanks again for choosing us, see you Tuesday!",
};

const estimateSendBlocks: TemplateBlocks = [
	{ kind: "logo" },
	{ kind: "heading", text: "Your estimate is ready" },
	{
		kind: "text",
		html: "Hi {{contact.first_name}}, thanks for the chance to work with {{business.name}}. Your estimate {{estimate.title}} for {{estimate.total}} is attached as a PDF.",
	},
	{ kind: "divider" },
	{
		kind: "text",
		html: "{{personal_note}}<br>Reply to this email with any questions.<br>{{sender.name}}, {{business.name}}",
	},
];

const invoiceSendBlocks: TemplateBlocks = [
	{ kind: "logo" },
	{ kind: "heading", text: "Your invoice is ready" },
	{
		kind: "text",
		html: "Hi {{contact.first_name}}, here is invoice {{invoice.number}} from {{business.name}} for {{invoice.total}}, due {{invoice.due_date}}. Your invoice is attached as a PDF.",
	},
	{ kind: "divider" },
	{
		kind: "text",
		html: "{{personal_note}}<br>Reply to this email with any questions.<br>{{sender.name}}, {{business.name}}",
	},
];

const contractSendBlocks: TemplateBlocks = [
	{ kind: "logo" },
	{ kind: "heading", text: "Your contract is ready to sign" },
	{
		kind: "text",
		html: "Hi {{contact.first_name}}, please review and sign {{contract.title}} from {{business.name}}. Use the link below to sign online.",
	},
	{ kind: "button", label: "Review and sign" },
	{ kind: "divider" },
	{
		kind: "text",
		html: "If the button does not work, open this link: {{signing_link}}. {{personal_note}}<br>Reply to this email with any questions.<br>{{sender.name}}, {{business.name}}",
	},
];

const contractBodyBlocks: TemplateBlocks = [
	{ kind: "heading", text: "Roofing Services Agreement" },
	{
		kind: "text",
		html: "This agreement is between {{business.name}} and {{contact.full_name}} for the property at {{deal.address}}, covering the work described in {{estimate.title}} for a total of {{estimate.total}}.",
	},
	{ kind: "heading", text: "Scope of work" },
	{
		kind: "text",
		html: "The contractor will complete the roofing work described in the attached estimate, using the materials and methods listed there.",
	},
	{ kind: "heading", text: "Schedule" },
	{
		kind: "text",
		html: "Work will begin on a date agreed with the customer and will be completed within a reasonable time, weather permitting.",
	},
	{ kind: "heading", text: "Warranty" },
	{
		kind: "text",
		html: "The contractor warrants the workmanship for one year from completion. Manufacturer warranties on materials apply separately.",
	},
];

export const DEFAULT_TEMPLATES: Record<
	TemplatePurpose,
	{
		name: string;
		type: TemplateType;
		subject: string | null;
		blocks: TemplateBlocks;
	}
> = {
	[TemplatePurpose.ESTIMATE_SEND]: {
		name: "Estimate email",
		type: TemplateType.EMAIL,
		subject: "Your estimate from {{business.name}}",
		blocks: estimateSendBlocks,
	},
	[TemplatePurpose.INVOICE_SEND]: {
		name: "Invoice email",
		type: TemplateType.EMAIL,
		subject: "Your invoice from {{business.name}}",
		blocks: invoiceSendBlocks,
	},
	[TemplatePurpose.CONTRACT_SEND]: {
		name: "Contract email",
		type: TemplateType.EMAIL,
		subject: "Please sign: {{contract.title}}",
		blocks: contractSendBlocks,
	},
	[TemplatePurpose.CONTRACT_BODY]: {
		name: "Standard contract",
		type: TemplateType.CONTRACT,
		subject: null,
		blocks: contractBodyBlocks,
	},
};
