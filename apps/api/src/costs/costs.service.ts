import { type Db, Prisma } from "@crm/db";
import { maskLineItems, moneyRefusalMessage } from "@crm/db/access-money";
import { type AccessPrincipal, hasMoney } from "@crm/db/access-policy";
import { dealScopeWhere, requiredDealChildWhere } from "@crm/db/access-scope";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { lineItemsTotalCents } from "../invoices/invoice-logic";
import { INVOICES } from "../invoices/invoices.config";
import type { CostCreateInput, CostUpdateInput } from "./costs.contracts";

@Injectable()
export class CostsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: { dealId: string }, p: AccessPrincipal) {
		await this.assertDealInScope(input.dealId, p);
		const where: Prisma.JobCostWhereInput = {
			AND: [{ dealId: input.dealId }, requiredDealChildWhere(p)],
		};
		const [rows, byCategory] = await Promise.all([
			this.db.jobCost.findMany({
				where,
				orderBy: [{ date: "desc" }, { createdAt: "desc" }],
				include: { createdBy: { select: { id: true, name: true } } },
			}),
			this.db.jobCost.groupBy({
				by: ["category", "currency"],
				where,
				_sum: { amountCents: true },
			}),
		]);
		const totalsByCurrency = new Map<string, number>();
		for (const row of byCategory) {
			totalsByCurrency.set(
				row.currency,
				(totalsByCurrency.get(row.currency) ?? 0) + (row._sum.amountCents ?? 0),
			);
		}
		return {
			rows: maskLineItems(p, "profit", rows, ["amountCents"]),
			totalsByCurrency: maskLineItems(
				p,
				"profit",
				[...totalsByCurrency].map(([currency, totalCents]) => ({
					currency,
					totalCents,
				})),
				["totalCents"],
			),
			totalsByCategory: maskLineItems(
				p,
				"profit",
				byCategory.map((row) => ({
					category: row.category,
					currency: row.currency,
					totalCents: row._sum.amountCents ?? 0,
				})),
				["totalCents"],
			),
		};
	}

	async create(input: CostCreateInput, userId: string, p: AccessPrincipal) {
		const deal = await this.assertDealInScope(input.dealId, p);
		return this.db.jobCost.create({
			data: { ...input, currency: deal.currency, createdById: userId },
		});
	}

	async update(input: CostUpdateInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
		const { id, ...data } = input;
		try {
			return await this.db.jobCost.update({ where: { id }, data });
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async remove(id: string, p: AccessPrincipal) {
		await this.assertInScope(id, p);
		try {
			return await this.db.jobCost.delete({
				where: { id },
				select: { id: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async profitForDeal(dealId: string, p: AccessPrincipal) {
		if (!hasMoney(p, "profit")) {
			throw new ForbiddenException(
				moneyRefusalMessage(p, "see job costs and profit."),
			);
		}
		await this.assertDealInScope(dealId, p);
		const [invoices, costs] = await Promise.all([
			this.db.invoice.findMany({
				where: { dealId, status: { in: [...INVOICES.revenueStatuses] } },
				select: {
					status: true,
					currency: true,
					lineItems: { select: { quantity: true, priceCents: true } },
				},
			}),
			this.db.jobCost.groupBy({
				by: ["currency"],
				where: { dealId },
				_sum: { amountCents: true },
			}),
		]);
		const byCurrency = new Map<
			string,
			{ invoicedCents: number; collectedCents: number; costsCents: number }
		>();
		const entry = (currency: string) => {
			const existing = byCurrency.get(currency);
			if (existing) return existing;
			const created = { invoicedCents: 0, collectedCents: 0, costsCents: 0 };
			byCurrency.set(currency, created);
			return created;
		};
		for (const invoice of invoices) {
			const total = lineItemsTotalCents(invoice.lineItems);
			const bucket = entry(invoice.currency);
			bucket.invoicedCents += total;
			if (invoice.status === "PAID") bucket.collectedCents += total;
		}
		for (const cost of costs) {
			entry(cost.currency).costsCents += cost._sum.amountCents ?? 0;
		}
		return {
			byCurrency: [...byCurrency].map(([currency, sums]) => {
				const profitCents = sums.invoicedCents - sums.costsCents;
				return {
					currency,
					...sums,
					profitCents,
					marginPct:
						sums.invoicedCents > 0
							? (profitCents / sums.invoicedCents) * 100
							: null,
				};
			}),
		};
	}

	private async assertDealInScope(dealId: string, p: AccessPrincipal) {
		const deal = await this.db.deal.findFirst({
			where: { AND: [{ id: dealId }, dealScopeWhere(p)] },
			select: { id: true, currency: true },
		});
		if (!deal) {
			throw new NotFoundException(`No deal with id ${dealId}.`);
		}
		return deal;
	}

	private async assertInScope(id: string, p: AccessPrincipal): Promise<void> {
		const found = await this.db.jobCost.findFirst({
			where: { AND: [{ id }, requiredDealChildWhere(p)] },
			select: { id: true },
		});
		if (!found) throw new NotFoundException(`No cost with id ${id}.`);
	}

	private translate(error: unknown, id: string): unknown {
		if (error instanceof NotFoundException) {
			return error;
		}
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No cost with id ${id}.`);
		}
		return error;
	}
}
