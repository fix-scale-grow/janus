import { WORKSPACE_ID } from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
import { WORKSHEET_PREFILL_KEYS } from "@crm/db/permits";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { formatCents } from "../documents/pdf-money";
import { tierTotals } from "../estimates/estimate-pdf";

const DEAL_SELECT = {
	name: true,
	number: true,
	currency: true,
	drawings: {
		select: { address: true },
		orderBy: { updatedAt: "desc" },
		take: 1,
	},
	contacts: {
		select: {
			contact: {
				select: {
					firstName: true,
					lastName: true,
					email: true,
					phone: true,
					createdAt: true,
				},
			},
		},
	},
	estimates: {
		where: { status: { in: ["SENT", "ACCEPTED"] } },
		select: {
			currency: true,
			selectedTier: true,
			createdAt: true,
			lineItems: {
				select: {
					quantity: true,
					priceGoodCents: true,
					priceBetterCents: true,
					priceBestCents: true,
				},
			},
		},
		orderBy: { createdAt: "desc" },
		take: 1,
	},
	invoices: {
		where: { status: { not: "VOID" } },
		select: {
			currency: true,
			createdAt: true,
			lineItems: { select: { quantity: true, priceCents: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 1,
	},
} satisfies Prisma.DealSelect;

export type PermitPrefillValues = Record<
	(typeof WORKSHEET_PREFILL_KEYS)[number],
	string
>;

@Injectable()
export class PermitPrefillService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async resolve(dealId: string): Promise<PermitPrefillValues> {
		const values: PermitPrefillValues = {
			job_address: "",
			job_name: "",
			job_number: "",
			job_valuation: "",
			owner_name: "",
			owner_email: "",
			owner_phone: "",
			contractor_name: "",
			scope_of_work: "",
		};

		const workspace = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { name: true },
		});
		values.contractor_name = workspace?.name ?? "";

		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: DEAL_SELECT,
		});
		if (!deal) return values;

		values.job_name = deal.name;
		values.job_number = String(deal.number);
		values.job_address = deal.drawings[0]?.address ?? "";

		const primaryContact = [...deal.contacts]
			.map((entry) => entry.contact)
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

		if (primaryContact) {
			values.owner_name = [primaryContact.firstName, primaryContact.lastName]
				.filter(Boolean)
				.join(" ");
			values.owner_email = primaryContact.email ?? "";
			values.owner_phone = primaryContact.phone ?? "";
		}

		const estimate = deal.estimates[0];
		if (estimate) {
			const total = tierTotals(
				estimate.lineItems.map((item) => ({
					name: "",
					unit: "PER_EACH",
					areaLabel: null,
					quantity: Number(item.quantity),
					priceGoodCents: item.priceGoodCents,
					priceBetterCents: item.priceBetterCents,
					priceBestCents: item.priceBestCents,
				})),
			)[estimate.selectedTier];
			values.job_valuation = formatCents(total, estimate.currency);
		} else {
			const invoice = deal.invoices[0];
			if (invoice) {
				const total = invoice.lineItems.reduce(
					(sum, item) =>
						sum + Math.round(Number(item.quantity) * item.priceCents),
					0,
				);
				values.job_valuation = formatCents(total, invoice.currency);
			}
		}

		return values;
	}
}
