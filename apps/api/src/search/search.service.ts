import type { Db, Prisma } from "@crm/db";
import { type AccessPrincipal, allows } from "@crm/db/access-policy";
import {
	contactScopeWhere,
	dealChildWhere,
	dealScopeWhere,
} from "@crm/db/access-scope";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { parseNumberQuery, SEARCH } from "./search.config";

export type SearchHit = {
	kind: "contact" | "deal" | "invoice" | "contract" | "drawing" | "estimate";
	id: string;
	label: string;
	detail: string | null;
	iconUrl: string | null;
	iconDarkUrl: string | null;
	iconTone: string | null;
	imageUrl: string | null;
};

const CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	companyName: true,
	imageUrl: true,
} as const;

const DEAL_SELECT = {
	id: true,
	name: true,
	number: true,
	stage: { select: { label: true } },
} as const;

type ContactRow = {
	id: string;
	firstName: string;
	lastName: string | null;
	email: string | null;
	companyName: string | null;
	imageUrl: string | null;
};

type DealRow = {
	id: string;
	name: string;
	number: number;
	stage: { label: string };
};

type DrawingRow = { id: string; title: string; address: string | null };

type EstimateRow = { id: string; title: string; status: string };

function statusLabel(status: string): string {
	return status.charAt(0) + status.slice(1).toLowerCase();
}

function toHit(
	partial: Pick<SearchHit, "kind" | "id" | "label" | "detail"> &
		Partial<SearchHit>,
): SearchHit {
	return {
		kind: partial.kind,
		id: partial.id,
		label: partial.label,
		detail: partial.detail,
		iconUrl: partial.iconUrl ?? null,
		iconDarkUrl: partial.iconDarkUrl ?? null,
		iconTone: partial.iconTone ?? null,
		imageUrl: partial.imageUrl ?? null,
	};
}

function contactLabel(contact: ContactRow): string {
	return (
		[contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
		contact.email ||
		"Unnamed"
	);
}

function contactHit(contact: ContactRow, detail?: string | null): SearchHit {
	return toHit({
		kind: "contact",
		id: contact.id,
		label: contactLabel(contact),
		detail: detail ?? contact.companyName ?? contact.email ?? null,
		imageUrl: contact.imageUrl,
	});
}

function dealHit(deal: DealRow): SearchHit {
	return toHit({
		kind: "deal",
		id: deal.id,
		label: deal.name,
		detail: `#${deal.number} · ${deal.stage.label}`,
	});
}

function invoiceHit(invoice: { id: string; number: number }): SearchHit {
	return toHit({
		kind: "invoice",
		id: invoice.id,
		label: `#${invoice.number}`,
		detail: null,
	});
}

function contractHit(contract: {
	id: string;
	number: number;
	title: string;
}): SearchHit {
	return toHit({
		kind: "contract",
		id: contract.id,
		label: `#${contract.number}`,
		detail: contract.title,
	});
}

function drawingHit(drawing: DrawingRow): SearchHit {
	return toHit({
		kind: "drawing",
		id: drawing.id,
		label: drawing.title,
		detail: drawing.address,
	});
}

function estimateHit(estimate: EstimateRow): SearchHit {
	return toHit({
		kind: "estimate",
		id: estimate.id,
		label: estimate.title,
		detail: statusLabel(estimate.status),
	});
}

function mergeHits(groups: SearchHit[][]): SearchHit[] {
	const seen = new Set<string>();
	const merged: SearchHit[] = [];

	for (const group of groups) {
		for (const hit of group) {
			if (seen.has(hit.id)) continue;
			seen.add(hit.id);
			merged.push(hit);
		}
	}

	return merged.slice(0, SEARCH.perKind);
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
	const seen = new Set<string>();
	const deduped: SearchHit[] = [];

	for (const hit of hits) {
		const key = `${hit.kind}:${hit.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(hit);
	}

	return deduped;
}

@Injectable()
export class SearchService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async quick(q: string, p: AccessPrincipal): Promise<{ hits: SearchHit[] }> {
		const term = q.trim();
		if (term.length < SEARCH.minLength) return { hits: [] };

		const canView = {
			contacts: allows(p, "contacts", "VIEW"),
			deals: allows(p, "deals", "VIEW"),
			drawings: allows(p, "drawings", "VIEW"),
			estimates: allows(p, "estimates", "VIEW"),
			invoices: allows(p, "invoices", "VIEW"),
			contracts: allows(p, "contracts", "VIEW"),
		};

		const asNumber = parseNumberQuery(term);
		const isDigitQuery = asNumber !== null;

		const [
			contactRows,
			dealRows,
			drawingRows,
			estimateRows,
			fieldValueHits,
			dealNumberRow,
			invoiceNumberRow,
			contractNumberRow,
		] = await Promise.all([
			canView.contacts ? this.searchContacts(term, p) : Promise.resolve([]),
			canView.deals ? this.searchDeals(term, p) : Promise.resolve([]),
			canView.drawings ? this.searchDrawings(term, p) : Promise.resolve([]),
			canView.estimates ? this.searchEstimates(term, p) : Promise.resolve([]),
			this.searchFieldValues(term, p, canView),
			asNumber === null || !canView.deals
				? Promise.resolve(null)
				: this.findDealByNumber(asNumber, p),
			asNumber === null || !canView.invoices
				? Promise.resolve(null)
				: this.findInvoiceByNumber(asNumber, p),
			asNumber === null || !canView.contracts
				? Promise.resolve(null)
				: this.findContractByNumber(asNumber, p),
		]);

		const fieldContactHits = fieldValueHits.filter(
			(hit): hit is SearchHit => hit.kind === "contact",
		);
		const fieldDealHits = fieldValueHits.filter(
			(hit): hit is SearchHit => hit.kind === "deal",
		);

		const contacts = mergeHits([
			contactRows.map((row) => contactHit(row)),
			fieldContactHits,
		]);

		const deals = mergeHits([
			dealNumberRow ? [dealHit(dealNumberRow)] : [],
			dealRows.map((row) => dealHit(row)),
			fieldDealHits,
		]);

		const invoices = mergeHits([
			invoiceNumberRow ? [invoiceHit(invoiceNumberRow)] : [],
		]);

		const contracts = mergeHits([
			contractNumberRow ? [contractHit(contractNumberRow)] : [],
		]);

		const drawings = mergeHits([drawingRows.map((row) => drawingHit(row))]);

		const estimates = mergeHits([estimateRows.map((row) => estimateHit(row))]);

		const numberFirstHits = isDigitQuery
			? [
					dealNumberRow ? dealHit(dealNumberRow) : null,
					invoiceNumberRow ? invoiceHit(invoiceNumberRow) : null,
					contractNumberRow ? contractHit(contractNumberRow) : null,
				].filter((hit): hit is SearchHit => hit !== null)
			: [];

		return {
			hits: dedupeHits([
				...numberFirstHits,
				...contacts,
				...deals,
				...invoices,
				...contracts,
				...drawings,
				...estimates,
			]),
		};
	}

	private async searchContacts(
		term: string,
		p: AccessPrincipal,
	): Promise<ContactRow[]> {
		const tokens = term.split(/\s+/).filter(Boolean).slice(0, SEARCH.maxTokens);

		const tokenClauses: Prisma.ContactWhereInput[] = tokens.map((token) => ({
			OR: [
				{ firstName: { contains: token, mode: "insensitive" } },
				{ lastName: { contains: token, mode: "insensitive" } },
				{ email: { contains: token, mode: "insensitive" } },
				{ companyName: { contains: token, mode: "insensitive" } },
			],
		}));

		return this.db.contact.findMany({
			where: {
				AND: [...tokenClauses, contactScopeWhere(p)],
			},
			take: SEARCH.perKind,
			orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
			select: CONTACT_SELECT,
		});
	}

	private async searchDeals(
		term: string,
		p: AccessPrincipal,
	): Promise<DealRow[]> {
		return this.db.deal.findMany({
			where: {
				AND: [
					{ name: { contains: term, mode: "insensitive" } },
					dealScopeWhere(p),
				],
			},
			take: SEARCH.perKind,
			orderBy: [{ stage: { position: "asc" } }, { name: "asc" }],
			select: DEAL_SELECT,
		});
	}

	private async searchDrawings(
		term: string,
		p: AccessPrincipal,
	): Promise<DrawingRow[]> {
		return this.db.drawing.findMany({
			where: {
				AND: [
					{ address: { contains: term, mode: "insensitive" } },
					dealChildWhere(p),
				],
			},
			take: SEARCH.perKind,
			orderBy: { updatedAt: "desc" },
			select: { id: true, title: true, address: true },
		});
	}

	private async searchEstimates(
		term: string,
		p: AccessPrincipal,
	): Promise<EstimateRow[]> {
		return this.db.estimate.findMany({
			where: {
				AND: [
					{ title: { contains: term, mode: "insensitive" } },
					dealChildWhere(p),
				],
			},
			take: SEARCH.perKind,
			orderBy: { updatedAt: "desc" },
			select: { id: true, title: true, status: true },
		});
	}

	private async findDealByNumber(
		number: number,
		p: AccessPrincipal,
	): Promise<DealRow | null> {
		return this.db.deal.findFirst({
			where: { AND: [{ number }, dealScopeWhere(p)] },
			select: DEAL_SELECT,
		});
	}

	private async findInvoiceByNumber(
		number: number,
		p: AccessPrincipal,
	): Promise<{ id: string; number: number } | null> {
		return this.db.invoice.findFirst({
			where: { AND: [{ number }, dealChildWhere(p)] },
			select: { id: true, number: true },
		});
	}

	private async findContractByNumber(
		number: number,
		p: AccessPrincipal,
	): Promise<{ id: string; number: number; title: string } | null> {
		return this.db.contract.findFirst({
			where: { AND: [{ number }, dealChildWhere(p)] },
			select: { id: true, number: true, title: true },
		});
	}

	private async searchFieldValues(
		term: string,
		p: AccessPrincipal,
		canView: { contacts: boolean; deals: boolean },
	): Promise<SearchHit[]> {
		if (!canView.contacts && !canView.deals) return [];

		const orClauses: Prisma.FieldValueWhereInput[] = [];
		if (canView.deals) {
			orClauses.push({ dealId: { not: null }, deal: dealScopeWhere(p) });
		}
		if (canView.contacts) {
			orClauses.push({
				contactId: { not: null },
				contact: contactScopeWhere(p),
			});
		}

		const rows = await this.db.fieldValue.findMany({
			where: {
				text: { contains: term, mode: "insensitive" },
				field: { type: "TEXT", archivedAt: null },
				OR: orClauses,
			},
			take: SEARCH.perKind * 4,
			select: {
				text: true,
				field: { select: { label: true } },
				deal: { select: DEAL_SELECT },
				contact: { select: CONTACT_SELECT },
			},
		});
		return rows.flatMap((row) => {
			if (row.text === null) return [];
			const detail = `${row.field.label}: ${row.text}`;
			if (row.deal && canView.deals) return [{ ...dealHit(row.deal), detail }];
			if (row.contact && canView.contacts) {
				return [contactHit(row.contact, detail)];
			}
			return [];
		});
	}
}
