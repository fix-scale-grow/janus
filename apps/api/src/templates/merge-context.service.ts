import { DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { formatCents } from "../documents/pdf-money";
import { TIER_LABEL, tierTotals } from "../estimates/estimate-pdf";

export type MergeContextRefs = {
	contactId?: string;
	dealId?: string;
	estimateId?: string;
	invoiceId?: string;
	contractId?: string;
	senderName?: string;
	signingLink?: string;
	personalNote?: string;
};

const CONTACT_SELECT = {
	firstName: true,
	lastName: true,
	email: true,
} as const;

const DEAL_SELECT = {
	name: true,
	drawings: {
		select: { address: true },
		orderBy: { updatedAt: "desc" },
		take: 1,
	},
} as const;

const ESTIMATE_SELECT = {
	title: true,
	currency: true,
	selectedTier: true,
	lineItems: {
		select: {
			quantity: true,
			priceGoodCents: true,
			priceBetterCents: true,
			priceBestCents: true,
		},
	},
} as const;

const INVOICE_SELECT = {
	number: true,
	currency: true,
	dueAt: true,
	lineItems: {
		select: { quantity: true, priceCents: true },
	},
} as const;

const CONTRACT_SELECT = {
	number: true,
	title: true,
} as const;

const DUE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
});

@Injectable()
export class MergeContextService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async resolve(refs: MergeContextRefs): Promise<Record<string, string>> {
		const context: Record<string, string> = {};

		const workspace = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { name: true },
		});
		context["business.name"] = workspace?.name ?? DEFAULT_WORKSPACE_NAME;
		context["business.phone"] = "";

		if (refs.senderName) context["sender.name"] = refs.senderName;
		if (refs.signingLink) context.signing_link = refs.signingLink;
		if (refs.personalNote) context.personal_note = refs.personalNote;

		if (refs.contactId) {
			const contact = await this.db.contact.findUnique({
				where: { id: refs.contactId },
				select: CONTACT_SELECT,
			});
			if (contact) {
				context["contact.full_name"] = [contact.firstName, contact.lastName]
					.filter(Boolean)
					.join(" ");
				context["contact.first_name"] = contact.firstName;
				context["contact.email"] = contact.email ?? "";
			}
		}

		if (refs.dealId) {
			const deal = await this.db.deal.findUnique({
				where: { id: refs.dealId },
				select: DEAL_SELECT,
			});
			if (deal) {
				context["deal.title"] = deal.name;
				context["deal.address"] = deal.drawings[0]?.address ?? "";
			}
		}

		if (refs.estimateId) {
			const estimate = await this.db.estimate.findUnique({
				where: { id: refs.estimateId },
				select: ESTIMATE_SELECT,
			});
			if (estimate) {
				const totals = tierTotals(
					estimate.lineItems.map((item) => ({
						name: "",
						unit: "PER_EACH",
						areaLabel: null,
						quantity: Number(item.quantity),
						priceGoodCents: item.priceGoodCents,
						priceBetterCents: item.priceBetterCents,
						priceBestCents: item.priceBestCents,
					})),
				);
				context["estimate.title"] = estimate.title;
				context["estimate.total"] = formatCents(
					totals[estimate.selectedTier],
					estimate.currency,
				);
				context["estimate.tier"] = TIER_LABEL[estimate.selectedTier];
			}
		}

		if (refs.invoiceId) {
			const invoice = await this.db.invoice.findUnique({
				where: { id: refs.invoiceId },
				select: INVOICE_SELECT,
			});
			if (invoice) {
				const total = invoice.lineItems.reduce(
					(sum, item) =>
						sum + Math.round(Number(item.quantity) * item.priceCents),
					0,
				);
				context["invoice.number"] = String(invoice.number);
				context["invoice.total"] = formatCents(total, invoice.currency);
				context["invoice.due_date"] = invoice.dueAt
					? DUE_DATE_FORMAT.format(invoice.dueAt)
					: "";
			}
		}

		if (refs.contractId) {
			const contract = await this.db.contract.findUnique({
				where: { id: refs.contractId },
				select: CONTRACT_SELECT,
			});
			if (contract) {
				context["contract.number"] = String(contract.number);
				context["contract.title"] = contract.title;
			}
		}

		return context;
	}
}
