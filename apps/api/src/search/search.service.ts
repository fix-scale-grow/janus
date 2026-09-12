import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { SEARCH } from "./search.config";

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

@Injectable()
export class SearchService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async quick(q: string): Promise<{ hits: SearchHit[] }> {
		const term = q.trim();
		if (term.length < SEARCH.minLength) return { hits: [] };

		const isDigits = /^\d+$/.test(term);
		const asNumber = isDigits ? Number(term) : null;

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
			this.searchContacts(term),
			this.searchDeals(term),
			this.searchDrawings(term),
			this.searchEstimates(term),
			this.searchFieldValues(term),
			asNumber === null
				? Promise.resolve(null)
				: this.findDealByNumber(asNumber),
			asNumber === null
				? Promise.resolve(null)
				: this.findInvoiceByNumber(asNumber),
			asNumber === null
				? Promise.resolve(null)
				: this.findContractByNumber(asNumber),
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

		return {
			hits: [
				...contacts,
				...deals,
				...invoices,
				...contracts,
				...drawings,
				...estimates,
			],
		};
	}

	private async searchContacts(term: string): Promise<ContactRow[]> {
		const tokens = term.split(/\s+/).filter(Boolean).slice(0, SEARCH.maxTokens);

		return this.db.contact.findMany({
			where: {
				AND: tokens.map((token) => ({
					OR: [
						{ firstName: { contains: token, mode: "insensitive" } },
						{ lastName: { contains: token, mode: "insensitive" } },
						{ email: { contains: token, mode: "insensitive" } },
						{ companyName: { contains: token, mode: "insensitive" } },
					],
				})),
			},
			take: SEARCH.perKind,
			orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
			select: CONTACT_SELECT,
		});
	}

	private async searchDeals(term: string): Promise<DealRow[]> {
		return this.db.deal.findMany({
			where: { name: { contains: term, mode: "insensitive" } },
			take: SEARCH.perKind,
			orderBy: [{ stage: { position: "asc" } }, { name: "asc" }],
			select: DEAL_SELECT,
		});
	}

	private async searchDrawings(term: string): Promise<DrawingRow[]> {
		return this.db.drawing.findMany({
			where: { address: { contains: term, mode: "insensitive" } },
			take: SEARCH.perKind,
			orderBy: { updatedAt: "desc" },
			select: { id: true, title: true, address: true },
		});
	}

	private async searchEstimates(term: string): Promise<EstimateRow[]> {
		return this.db.estimate.findMany({
			where: { title: { contains: term, mode: "insensitive" } },
			take: SEARCH.perKind,
			orderBy: { updatedAt: "desc" },
			select: { id: true, title: true, status: true },
		});
	}

	private async findDealByNumber(number: number): Promise<DealRow | null> {
		return this.db.deal.findUnique({
			where: { number },
			select: DEAL_SELECT,
		});
	}

	private async findInvoiceByNumber(
		number: number,
	): Promise<{ id: string; number: number } | null> {
		return this.db.invoice.findUnique({
			where: { number },
			select: { id: true, number: true },
		});
	}

	private async findContractByNumber(
		number: number,
	): Promise<{ id: string; number: number; title: string } | null> {
		return this.db.contract.findUnique({
			where: { number },
			select: { id: true, number: true, title: true },
		});
	}

	private async searchFieldValues(term: string): Promise<SearchHit[]> {
		const rows = await this.db.fieldValue.findMany({
			where: {
				text: { contains: term, mode: "insensitive" },
				field: { type: "TEXT", archivedAt: null },
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
			if (row.deal) return [{ ...dealHit(row.deal), detail }];
			if (row.contact) return [contactHit(row.contact, detail)];
			return [];
		});
	}
}
