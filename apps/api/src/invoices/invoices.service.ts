import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate, resolveOrderBy } from "../trpc/list-input";
import { agingBucket, linesFromEstimate } from "./invoice-logic";
import { INVOICES } from "./invoices.config";
import type {
	InvoiceAddLineItemInput,
	InvoiceCreateFromEstimateInput,
	InvoiceCreateInput,
	InvoiceListInput,
	InvoiceSetStatusInput,
	InvoiceUpdateInput,
	InvoiceUpdateLineItemInput,
} from "./invoices.contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.InvoiceOrderByWithRelationInput[]
> = {
	number: (dir) => [{ number: dir }],
	status: (dir) => [{ status: dir }],
	dueAt: (dir) => [{ dueAt: dir }],
	updatedAt: (dir) => [{ updatedAt: dir }],
};

const LIST_SELECT = {
	id: true,
	number: true,
	status: true,
	currency: true,
	contactId: true,
	dealId: true,
	dueAt: true,
	updatedAt: true,
	contact: { select: { firstName: true, lastName: true } },
	deal: { select: { name: true } },
	lineItems: { select: { quantity: true, priceCents: true } },
} as const;

function contactName(
	contact: { firstName: string; lastName: string | null } | null,
): string | null {
	if (!contact) return null;
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

function lineItemsTotalCents(
	lineItems: {
		quantity: Prisma.Decimal | number | string;
		priceCents: number;
	}[],
): number {
	return lineItems.reduce(
		(sum, item) => sum + Math.round(Number(item.quantity) * item.priceCents),
		0,
	);
}

@Injectable()
export class InvoicesService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: InvoiceListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);
		const now = new Date();

		const [rows, total] = await Promise.all([
			this.db.invoice.findMany({
				where,
				orderBy: resolveOrderBy(input, SORTABLE, [{ updatedAt: "desc" }]),
				skip,
				take,
				select: LIST_SELECT,
			}),
			this.db.invoice.count({ where }),
		]);

		return {
			rows: rows.map(({ contact, deal, lineItems, ...row }) => ({
				...row,
				contactName: contactName(contact),
				dealName: deal?.name ?? null,
				totalCents: lineItemsTotalCents(lineItems),
				aging: agingBucket(row.dueAt, row.status, now),
			})),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string) {
		const row = await this.db.invoice.findUnique({
			where: { id },
			include: {
				lineItems: { orderBy: { sortOrder: "asc" } },
			},
		});

		if (!row) {
			throw new NotFoundException(`No invoice with id ${id}.`);
		}

		return {
			...row,
			totalCents: lineItemsTotalCents(row.lineItems),
			aging: agingBucket(row.dueAt, row.status, new Date()),
		};
	}

	async create(input: InvoiceCreateInput, userId: string) {
		const currency = await this.currencyFor(input.dealId);

		try {
			return await this.db.invoice.create({
				data: {
					dealId: input.dealId,
					contactId: input.contactId,
					currency,
					createdById: userId,
				},
			});
		} catch (error) {
			throw this.translate(error);
		}
	}

	async createFromEstimate(
		input: InvoiceCreateFromEstimateInput,
		userId: string,
	) {
		const estimate = await this.db.estimate.findUnique({
			where: { id: input.estimateId },
			include: { lineItems: { orderBy: { sortOrder: "asc" } } },
		});

		if (!estimate) {
			throw new NotFoundException(`No estimate with id ${input.estimateId}.`);
		}

		if (estimate.lineItems.length === 0) {
			throw new BadRequestException("This estimate has no line items.");
		}

		const tier = input.tier ?? estimate.selectedTier;
		const lines = linesFromEstimate(estimate, tier);
		const dueAt = new Date(Date.now() + INVOICES.defaultNetDays * DAY_MS);

		return this.db.$transaction(async (tx) => {
			const invoice = await tx.invoice.create({
				data: {
					status: "DRAFT",
					currency: estimate.currency,
					dealId: estimate.dealId,
					contactId: estimate.contactId,
					estimateId: estimate.id,
					dueAt,
					createdById: userId,
				},
			});

			await tx.invoiceLineItem.createMany({
				data: lines.map((line) => ({
					invoiceId: invoice.id,
					...line,
				})),
			});

			return { id: invoice.id };
		});
	}

	async setStatus(input: InvoiceSetStatusInput) {
		const invoice = await this.db.invoice.findUnique({
			where: { id: input.id },
			select: { issuedAt: true },
		});
		if (!invoice) {
			throw new NotFoundException(`No invoice with id ${input.id}.`);
		}

		const issuedAt =
			input.status === "SENT" && !invoice.issuedAt ? new Date() : undefined;

		try {
			return await this.db.invoice.update({
				where: { id: input.id },
				data: { status: input.status, ...(issuedAt ? { issuedAt } : {}) },
				select: { id: true, status: true, issuedAt: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async markPaid(id: string) {
		try {
			return await this.db.invoice.update({
				where: { id },
				data: { status: "PAID", paidAt: new Date() },
				select: { id: true, status: true, paidAt: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async update(input: InvoiceUpdateInput) {
		try {
			return await this.db.invoice.update({
				where: { id: input.id },
				data: input.data,
				select: {
					id: true,
					notes: true,
					dueAt: true,
					issuedAt: true,
					contactId: true,
				},
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async delete(id: string) {
		try {
			return await this.db.invoice.delete({
				where: { id },
				select: { id: true, number: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async addLineItem(input: InvoiceAddLineItemInput) {
		const invoice = await this.db.invoice.findUnique({
			where: { id: input.invoiceId },
			select: { id: true },
		});
		if (!invoice) {
			throw new NotFoundException(`No invoice with id ${input.invoiceId}.`);
		}

		const count = await this.db.invoiceLineItem.count({
			where: { invoiceId: input.invoiceId },
		});

		return this.db.invoiceLineItem.create({
			data: {
				invoiceId: input.invoiceId,
				name: input.name,
				unit: input.unit,
				quantity: input.quantity,
				priceCents: input.priceCents,
				areaLabel: input.areaLabel,
				sortOrder: count,
			},
		});
	}

	async updateLineItem(input: InvoiceUpdateLineItemInput) {
		try {
			return await this.db.invoiceLineItem.update({
				where: { id: input.id },
				data: input.data,
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async removeLineItem(id: string) {
		try {
			return await this.db.invoiceLineItem.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	private async currencyFor(dealId: string | undefined): Promise<string> {
		if (!dealId) return "USD";
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: { currency: true },
		});
		return deal?.currency ?? "USD";
	}

	private buildWhere(input: InvoiceListInput): Prisma.InvoiceWhereInput {
		const where: Prisma.InvoiceWhereInput = {
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.contactId ? { contactId: input.contactId } : {}),
			...(input.estimateId ? { estimateId: input.estimateId } : {}),
			...(input.status ? { status: input.status } : {}),
		};

		const term = input.q.trim();
		if (term) {
			const asNumber = Number(term);
			if (Number.isInteger(asNumber)) {
				where.number = asNumber;
			}
		}

		return where;
	}

	private translate(error: unknown, id?: string): unknown {
		if (error instanceof NotFoundException) {
			return error;
		}
		if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (error.code === "P2025" && id) {
				return new NotFoundException(`No invoice with id ${id}.`);
			}
			if (error.code === "P2003") {
				return new BadRequestException("That record no longer exists.");
			}
		}
		return error;
	}
}
