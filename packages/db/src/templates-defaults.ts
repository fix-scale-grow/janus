import { TemplatePurpose, TemplateType } from "./generated/prisma/enums";

export type DefaultTemplateBlock =
	| { kind: "logo" }
	| { kind: "divider" }
	| { kind: "heading"; text: string }
	| { kind: "text"; html: string }
	| { kind: "button"; label: string };

const estimateSendBlocks: DefaultTemplateBlock[] = [
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

const invoiceSendBlocks: DefaultTemplateBlock[] = [
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

const contractSendBlocks: DefaultTemplateBlock[] = [
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

const formNotifyBlocks: DefaultTemplateBlock[] = [
	{ kind: "logo" },
	{ kind: "heading", text: "New lead from {{form.name}}" },
	{
		kind: "text",
		html: "{{form.name}} was just submitted by {{contact.full_name}} ({{contact.email}}).",
	},
	{ kind: "divider" },
];

const proposalSendBlocks: DefaultTemplateBlock[] = [
	{ kind: "logo" },
	{ kind: "heading", text: "Your proposal is ready" },
	{
		kind: "text",
		html: "Hi {{contact.first_name}}, your proposal from {{business.name}} is ready to review. Open it online to see your options and pick the one that fits.",
	},
	{ kind: "button", label: "View your proposal" },
	{ kind: "divider" },
	{
		kind: "text",
		html: "If the button does not work, open this link: {{proposal_link}}. {{personal_note}}<br>Reply to this email with any questions.<br>{{sender.name}}, {{business.name}}",
	},
];

const proposalBodyBlocks: DefaultTemplateBlock[] = [
	{ kind: "heading", text: "Prepared for {{contact.full_name}}" },
	{
		kind: "text",
		html: "Thank you for the opportunity to earn your business. This proposal covers everything we discussed, with three options priced below. Pick the one that fits and accept online.",
	},
	{ kind: "heading", text: "Why {{business.name}}" },
	{
		kind: "text",
		html: "Licensed and insured, with a workmanship warranty on every job. We show up when we say we will and leave the site cleaner than we found it.",
	},
];

const contractBodyBlocks: DefaultTemplateBlock[] = [
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

export const TEMPLATE_DEFAULTS: Record<
	TemplatePurpose,
	{
		name: string;
		type: TemplateType;
		subject: string | null;
		blocks: DefaultTemplateBlock[];
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
	[TemplatePurpose.PROPOSAL_SEND]: {
		name: "Proposal email",
		type: TemplateType.EMAIL,
		subject: "Your proposal from {{business.name}}",
		blocks: proposalSendBlocks,
	},
	[TemplatePurpose.PROPOSAL_BODY]: {
		name: "Standard proposal",
		type: TemplateType.CONTRACT,
		subject: null,
		blocks: proposalBodyBlocks,
	},
	[TemplatePurpose.FORM_NOTIFY]: {
		name: "Form notification",
		type: TemplateType.EMAIL,
		subject: "New lead from {{form.name}}",
		blocks: formNotifyBlocks,
	},
};
