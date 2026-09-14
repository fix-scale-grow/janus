import type { Db } from "@crm/db";
import { Inject, Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { formatCents } from "../documents/pdf-money";
import { lineItemsTotalCents } from "../invoices/invoice-logic";
import { INVOICES } from "../invoices/invoices.config";
import { PERMISSION_KEYS } from "../permissions/permissions.config";
import { PermissionsService } from "../permissions/permissions.service";
import { toDay } from "../projects/projects.contracts";
import { REPORTS } from "./reports.config";
import type {
	ArAgingRow,
	CostByCreatorRow,
	CostByDealRow,
	CostCategoryRow,
	JobProfitabilityRow,
	ProfitOverTimeRow,
	ReportKpi,
	ReportRangeInput,
	ReportSeriesPoint,
} from "./reports.contracts";
import {
	AGING_BUCKETS,
	agingBucket,
	agingDays,
	fallbackDueAt,
} from "./reports-logic";

const TRAILING_MONTHS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

function monthKey(date: Date): string {
	return date.toISOString().slice(0, 7);
}

function monthStart(from: Date, monthsBack: number): Date {
	return toDay(
		new Date(
			Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - monthsBack, 1),
		),
	);
}

function monthSeries(start: Date, count: number): string[] {
	return Array.from({ length: count }, (_, index) =>
		monthKey(
			new Date(
				Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1),
			),
		),
	);
}

type ClientBucket = {
	contactId: string;
	name: string;
	currency: string;
	dealCount: number;
	invoicedCents: number;
	costsCents: number;
};

type MonthBucket = { invoicedCents: number; costsCents: number };

@Injectable()
export class ReportsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		@Inject(PermissionsService)
		private readonly permissions: PermissionsService,
	) {}

	async byClient(userId: string) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);

		const deals = await this.db.deal.findMany({
			select: {
				id: true,
				currency: true,
				contacts: {
					select: {
						contact: { select: { id: true, firstName: true, lastName: true } },
					},
				},
				invoices: {
					where: { status: { in: [...INVOICES.revenueStatuses] } },
					select: {
						currency: true,
						lineItems: { select: { quantity: true, priceCents: true } },
					},
				},
				jobCosts: { select: { currency: true, amountCents: true } },
			},
		});

		const buckets = new Map<string, ClientBucket>();
		const bucket = (contactId: string, name: string, currency: string) => {
			const key = `${contactId}\u0000${currency}`;
			const existing = buckets.get(key);
			if (existing) return existing;
			const created: ClientBucket = {
				contactId,
				name,
				currency,
				dealCount: 0,
				invoicedCents: 0,
				costsCents: 0,
			};
			buckets.set(key, created);
			return created;
		};

		for (const deal of deals) {
			const contacts = deal.contacts.map((link) => link.contact);
			if (contacts.length === 0) continue;

			for (const contact of contacts) {
				const name = [contact.firstName, contact.lastName]
					.filter(Boolean)
					.join(" ");

				bucket(contact.id, name, deal.currency).dealCount += 1;

				for (const invoice of deal.invoices) {
					const total = lineItemsTotalCents(invoice.lineItems);
					bucket(contact.id, name, invoice.currency).invoicedCents += total;
				}
				for (const cost of deal.jobCosts) {
					bucket(contact.id, name, cost.currency).costsCents +=
						cost.amountCents;
				}
			}
		}

		return {
			rows: [...buckets.values()]
				.map((row) => {
					const profitCents = row.invoicedCents - row.costsCents;
					return {
						...row,
						profitCents,
						marginPct:
							row.invoicedCents > 0
								? (profitCents / row.invoicedCents) * 100
								: null,
					};
				})
				.sort((a, b) => b.profitCents - a.profitCents),
		};
	}

	async byMonth(userId: string) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);

		const now = new Date();
		const start = monthStart(now, TRAILING_MONTHS - 1);

		const [invoices, costs] = await Promise.all([
			this.db.invoice.findMany({
				where: {
					status: { in: [...INVOICES.revenueStatuses] },
					OR: [
						{ issuedAt: { gte: start } },
						{ issuedAt: null, createdAt: { gte: start } },
					],
				},
				select: {
					issuedAt: true,
					createdAt: true,
					currency: true,
					lineItems: { select: { quantity: true, priceCents: true } },
				},
			}),
			this.db.jobCost.findMany({
				where: { date: { gte: start } },
				select: { date: true, currency: true, amountCents: true },
			}),
		]);

		const byCurrency = new Map<string, Map<string, MonthBucket>>();
		const currencies = new Set<string>();
		const cell = (currency: string, month: string) => {
			currencies.add(currency);
			let months = byCurrency.get(currency);
			if (!months) {
				months = new Map();
				byCurrency.set(currency, months);
			}
			let value = months.get(month);
			if (!value) {
				value = { invoicedCents: 0, costsCents: 0 };
				months.set(month, value);
			}
			return value;
		};

		for (const invoice of invoices) {
			const date = invoice.issuedAt ?? invoice.createdAt;
			const total = lineItemsTotalCents(invoice.lineItems);
			cell(invoice.currency, monthKey(date)).invoicedCents += total;
		}
		for (const cost of costs) {
			cell(cost.currency, monthKey(cost.date)).costsCents += cost.amountCents;
		}

		const months = monthSeries(start, TRAILING_MONTHS);
		const rows: {
			month: string;
			currency: string;
			invoicedCents: number;
			costsCents: number;
			profitCents: number;
		}[] = [];
		for (const currency of currencies) {
			for (const month of months) {
				const value = byCurrency.get(currency)?.get(month) ?? {
					invoicedCents: 0,
					costsCents: 0,
				};
				rows.push({
					month,
					currency,
					invoicedCents: value.invoicedCents,
					costsCents: value.costsCents,
					profitCents: value.invoicedCents - value.costsCents,
				});
			}
		}

		return { rows };
	}

	async byCategory(userId: string, input: ReportRangeInput) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);

		const now = new Date();
		const defaultStart = monthStart(now, TRAILING_MONTHS - 1);
		const from = input.from ?? defaultStart;
		const to = input.to ?? now;

		const grouped = await this.db.jobCost.groupBy({
			by: ["category", "currency"],
			where: { date: { gte: from, lte: to } },
			_sum: { amountCents: true },
		});

		return {
			rows: grouped.map((row) => ({
				category: row.category,
				currency: row.currency,
				totalCents: row._sum.amountCents ?? 0,
			})),
		};
	}

	async jobProfitability(userId: string, input: ReportRangeInput) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);

		const now = new Date();
		const from = input.from ?? monthStart(now, REPORTS.trailingMonths - 1);
		const to = input.to ?? now;

		const [invoices, costs] = await Promise.all([
			this.db.invoice.findMany({
				where: {
					status: { in: [...INVOICES.revenueStatuses] },
					dealId: { not: null },
					OR: [
						{ issuedAt: { gte: from, lte: to } },
						{ issuedAt: null, createdAt: { gte: from, lte: to } },
					],
				},
				select: {
					dealId: true,
					currency: true,
					status: true,
					lineItems: { select: { quantity: true, priceCents: true } },
				},
			}),
			this.db.jobCost.findMany({
				where: { date: { gte: from, lte: to } },
				select: { dealId: true, currency: true, amountCents: true },
			}),
		]);

		type DealBucket = {
			invoicedCents: number;
			collectedCents: number;
			costsCents: number;
		};
		const buckets = new Map<string, DealBucket>();
		const bucket = (dealId: string) => {
			let value = buckets.get(dealId);
			if (!value) {
				value = { invoicedCents: 0, collectedCents: 0, costsCents: 0 };
				buckets.set(dealId, value);
			}
			return value;
		};

		let excluded = 0;
		for (const invoice of invoices) {
			if (!invoice.dealId) continue;
			if (invoice.currency !== "USD") {
				excluded += 1;
				continue;
			}
			const total = lineItemsTotalCents(invoice.lineItems);
			const value = bucket(invoice.dealId);
			value.invoicedCents += total;
			if (invoice.status === "PAID") value.collectedCents += total;
		}
		for (const cost of costs) {
			if (cost.currency !== "USD") {
				excluded += 1;
				continue;
			}
			bucket(cost.dealId).costsCents += cost.amountCents;
		}

		const dealIds = [...buckets.keys()];
		const deals = dealIds.length
			? await this.db.deal.findMany({
					where: { id: { in: dealIds } },
					select: {
						id: true,
						name: true,
						number: true,
						contacts: {
							orderBy: [{ createdAt: "asc" }, { contactId: "asc" }],
							take: 1,
							select: {
								contact: {
									select: { id: true, firstName: true, lastName: true },
								},
							},
						},
					},
				})
			: [];

		const rows: JobProfitabilityRow[] = deals
			.map((deal) => {
				const value = bucket(deal.id);
				const profitCents = value.invoicedCents - value.costsCents;
				const collectedProfitCents = value.collectedCents - value.costsCents;
				const primary = deal.contacts[0]?.contact ?? null;
				return {
					dealId: deal.id,
					dealName: deal.name,
					dealNumber: deal.number,
					primaryContactId: primary?.id ?? null,
					primaryContactName: primary
						? [primary.firstName, primary.lastName].filter(Boolean).join(" ")
						: null,
					invoicedCents: value.invoicedCents,
					collectedCents: value.collectedCents,
					costsCents: value.costsCents,
					profitCents,
					collectedProfitCents,
					marginPct:
						value.invoicedCents > 0
							? (profitCents / value.invoicedCents) * 100
							: null,
				};
			})
			.sort((a, b) => b.profitCents - a.profitCents);

		const totals = rows.reduce(
			(acc, row) => {
				acc.invoicedCents += row.invoicedCents;
				acc.collectedCents += row.collectedCents;
				acc.costsCents += row.costsCents;
				acc.profitCents += row.profitCents;
				return acc;
			},
			{ invoicedCents: 0, collectedCents: 0, costsCents: 0, profitCents: 0 },
		);
		const marginRows = rows.filter((row) => row.marginPct !== null);
		const avgMarginPct = marginRows.length
			? marginRows.reduce((sum, row) => sum + (row.marginPct ?? 0), 0) /
				marginRows.length
			: null;

		const kpis: ReportKpi[] = [
			{
				key: "invoiced",
				label: "Invoiced",
				value: formatCents(totals.invoicedCents, "USD"),
			},
			{
				key: "collected",
				label: "Collected",
				value: formatCents(totals.collectedCents, "USD"),
			},
			{
				key: "costs",
				label: "Costs",
				value: formatCents(totals.costsCents, "USD"),
			},
			{
				key: "profit",
				label: "Profit",
				value: formatCents(totals.profitCents, "USD"),
			},
			{
				key: "avgMargin",
				label: "Avg margin",
				value: avgMarginPct === null ? "—" : `${avgMarginPct.toFixed(1)}%`,
			},
		];

		const series: ReportSeriesPoint[] = rows
			.slice(0, REPORTS.topDeals)
			.map((row) => ({ x: row.dealName, value: row.profitCents }));

		return { kpis, series, rows, excluded };
	}

	async profitOverTime(userId: string, input: ReportRangeInput) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);

		const now = new Date();
		const from = input.from ?? monthStart(now, REPORTS.trailingMonths - 1);
		const to = input.to ?? now;

		const [invoices, costs] = await Promise.all([
			this.db.invoice.findMany({
				where: {
					OR: [
						{
							status: { in: [...INVOICES.revenueStatuses] },
							issuedAt: { gte: from, lte: to },
						},
						{
							status: { in: [...INVOICES.revenueStatuses] },
							issuedAt: null,
							createdAt: { gte: from, lte: to },
						},
						{ status: "PAID", paidAt: { gte: from, lte: to } },
					],
				},
				select: {
					status: true,
					currency: true,
					issuedAt: true,
					createdAt: true,
					paidAt: true,
					lineItems: { select: { quantity: true, priceCents: true } },
				},
			}),
			this.db.jobCost.findMany({
				where: { date: { gte: from, lte: to } },
				select: { date: true, currency: true, amountCents: true },
			}),
		]);

		const invoicedByMonth = new Map<string, number>();
		const collectedByMonth = new Map<string, number>();
		const costsByMonth = new Map<string, number>();
		let excluded = 0;

		const revenueStatuses: readonly string[] = INVOICES.revenueStatuses;
		for (const invoice of invoices) {
			if (invoice.currency !== "USD") {
				excluded += 1;
				continue;
			}
			const total = lineItemsTotalCents(invoice.lineItems);
			if (revenueStatuses.includes(invoice.status)) {
				const issued = invoice.issuedAt ?? invoice.createdAt;
				if (issued >= from && issued <= to) {
					const key = monthKey(issued);
					invoicedByMonth.set(key, (invoicedByMonth.get(key) ?? 0) + total);
				}
			}
			if (
				invoice.status === "PAID" &&
				invoice.paidAt &&
				invoice.paidAt >= from &&
				invoice.paidAt <= to
			) {
				const key = monthKey(invoice.paidAt);
				collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + total);
			}
		}
		for (const cost of costs) {
			if (cost.currency !== "USD") {
				excluded += 1;
				continue;
			}
			const key = monthKey(cost.date);
			costsByMonth.set(key, (costsByMonth.get(key) ?? 0) + cost.amountCents);
		}

		const months = monthsBetween(from, to);
		const rows: ProfitOverTimeRow[] = months.map((month) => ({
			month,
			invoicedCents: invoicedByMonth.get(month) ?? 0,
			collectedCents: collectedByMonth.get(month) ?? 0,
			costsCents: costsByMonth.get(month) ?? 0,
		}));

		const totals = rows.reduce(
			(acc, row) => {
				acc.invoicedCents += row.invoicedCents;
				acc.collectedCents += row.collectedCents;
				acc.costsCents += row.costsCents;
				return acc;
			},
			{ invoicedCents: 0, collectedCents: 0, costsCents: 0 },
		);

		const kpis: ReportKpi[] = [
			{
				key: "invoiced",
				label: "Invoiced",
				value: formatCents(totals.invoicedCents, "USD"),
			},
			{
				key: "collected",
				label: "Collected",
				value: formatCents(totals.collectedCents, "USD"),
			},
			{
				key: "costs",
				label: "Costs",
				value: formatCents(totals.costsCents, "USD"),
			},
			{
				key: "profit",
				label: "Profit",
				value: formatCents(totals.invoicedCents - totals.costsCents, "USD"),
			},
		];

		const series: ReportSeriesPoint[] = rows.map((row) => ({
			x: row.month,
			invoicedCents: row.invoicedCents,
			collectedCents: row.collectedCents,
			costsCents: row.costsCents,
		}));

		return { kpis, series, rows, excluded };
	}

	async costBreakdown(userId: string, input: ReportRangeInput) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);

		const now = new Date();
		const from = input.from ?? monthStart(now, REPORTS.trailingMonths - 1);
		const to = input.to ?? now;

		const costs = await this.db.jobCost.findMany({
			where: { date: { gte: from, lte: to } },
			select: {
				currency: true,
				amountCents: true,
				category: true,
				receiptPath: true,
				dealId: true,
				deal: { select: { name: true } },
				createdById: true,
				createdBy: { select: { name: true } },
			},
		});

		let excluded = 0;
		let usdCount = 0;
		let receiptCount = 0;
		const byCategory = new Map<string, number>();
		const byDeal = new Map<string, { dealName: string; totalCents: number }>();
		const byCreator = new Map<
			string,
			{ creatorName: string; totalCents: number }
		>();

		for (const cost of costs) {
			if (cost.currency !== "USD") {
				excluded += 1;
				continue;
			}
			usdCount += 1;
			if (cost.receiptPath) receiptCount += 1;
			byCategory.set(
				cost.category,
				(byCategory.get(cost.category) ?? 0) + cost.amountCents,
			);
			const dealBucket = byDeal.get(cost.dealId) ?? {
				dealName: cost.deal.name,
				totalCents: 0,
			};
			dealBucket.totalCents += cost.amountCents;
			byDeal.set(cost.dealId, dealBucket);
			const creatorBucket = byCreator.get(cost.createdById) ?? {
				creatorName: cost.createdBy.name,
				totalCents: 0,
			};
			creatorBucket.totalCents += cost.amountCents;
			byCreator.set(cost.createdById, creatorBucket);
		}

		const rows: CostCategoryRow[] = [...byCategory.entries()]
			.map(([category, totalCents]) => ({ category, totalCents }))
			.sort((a, b) => b.totalCents - a.totalCents);

		const byDealRows: CostByDealRow[] = [...byDeal.entries()]
			.map(([dealId, value]) => ({
				dealId,
				dealName: value.dealName,
				totalCents: value.totalCents,
			}))
			.sort((a, b) => b.totalCents - a.totalCents)
			.slice(0, REPORTS.topDeals);

		const byCreatorRows: CostByCreatorRow[] = [...byCreator.entries()]
			.map(([creatorId, value]) => ({
				creatorId,
				creatorName: value.creatorName,
				totalCents: value.totalCents,
			}))
			.sort((a, b) => b.totalCents - a.totalCents);

		const totalCents = rows.reduce((sum, row) => sum + row.totalCents, 0);
		const receiptCoveragePct =
			usdCount > 0 ? (receiptCount / usdCount) * 100 : null;

		const kpis: ReportKpi[] = [
			{
				key: "totalCosts",
				label: "Total costs",
				value: formatCents(totalCents, "USD"),
			},
			{
				key: "receiptCoverage",
				label: "Receipt coverage",
				value:
					receiptCoveragePct === null
						? "—"
						: `${receiptCoveragePct.toFixed(0)}%`,
			},
		];

		const series: ReportSeriesPoint[] = rows.map((row) => ({
			x: row.category,
			value: row.totalCents,
		}));

		return {
			kpis,
			series,
			rows,
			byDeal: byDealRows,
			byCreator: byCreatorRows,
			excluded,
		};
	}

	async arAging(userId: string, input: ReportRangeInput) {
		await this.permissions.assertPermission(userId, PERMISSION_KEYS.profitView);

		const now = new Date();
		const from = input.from ?? monthStart(now, REPORTS.trailingMonths - 1);
		const to = input.to ?? now;

		const [sentInvoices, paidInvoices] = await Promise.all([
			this.db.invoice.findMany({
				where: {
					status: "SENT",
					OR: [
						{ issuedAt: { gte: from, lte: to } },
						{ issuedAt: null, createdAt: { gte: from, lte: to } },
					],
				},
				select: {
					id: true,
					number: true,
					currency: true,
					dueAt: true,
					issuedAt: true,
					createdAt: true,
					dealId: true,
					deal: { select: { name: true } },
					lineItems: { select: { quantity: true, priceCents: true } },
				},
			}),
			this.db.invoice.findMany({
				where: {
					status: "PAID",
					paidAt: { not: null },
					OR: [
						{ issuedAt: { gte: from, lte: to } },
						{ issuedAt: null, createdAt: { gte: from, lte: to } },
					],
				},
				select: {
					currency: true,
					issuedAt: true,
					createdAt: true,
					paidAt: true,
				},
			}),
		]);

		let excluded = 0;
		const rows: ArAgingRow[] = [];
		for (const invoice of sentInvoices) {
			if (invoice.currency !== "USD") {
				excluded += 1;
				continue;
			}
			const effectiveDueAt = fallbackDueAt(invoice);
			rows.push({
				invoiceId: invoice.id,
				number: invoice.number,
				dealId: invoice.dealId,
				dealName: invoice.deal?.name ?? null,
				dueAt: effectiveDueAt.toISOString(),
				ageDays: agingDays(effectiveDueAt, now),
				bucket: agingBucket(effectiveDueAt, now),
				totalCents: lineItemsTotalCents(invoice.lineItems),
			});
		}
		rows.sort((a, b) => b.ageDays - a.ageDays);

		let daysToPaySum = 0;
		let daysToPayCount = 0;
		for (const invoice of paidInvoices) {
			if (invoice.currency !== "USD") {
				excluded += 1;
				continue;
			}
			if (!invoice.paidAt) continue;
			const issued = invoice.issuedAt ?? invoice.createdAt;
			daysToPaySum += (invoice.paidAt.getTime() - issued.getTime()) / DAY_MS;
			daysToPayCount += 1;
		}

		const totalOutstandingCents = rows.reduce(
			(sum, row) => sum + row.totalCents,
			0,
		);
		const overdueCents = rows
			.filter((row) => row.bucket !== "current")
			.reduce((sum, row) => sum + row.totalCents, 0);
		const avgDaysToPay =
			daysToPayCount > 0 ? daysToPaySum / daysToPayCount : null;

		const kpis: ReportKpi[] = [
			{
				key: "outstanding",
				label: "Outstanding",
				value: formatCents(totalOutstandingCents, "USD"),
			},
			{
				key: "overdue",
				label: "Overdue",
				value: formatCents(overdueCents, "USD"),
				tone: overdueCents > 0 ? "warning" : "default",
			},
			{
				key: "avgDaysToPay",
				label: "Avg days to pay",
				value: avgDaysToPay === null ? "—" : avgDaysToPay.toFixed(1),
			},
		];

		const bucketTotals = new Map<string, number>();
		for (const row of rows) {
			bucketTotals.set(
				row.bucket,
				(bucketTotals.get(row.bucket) ?? 0) + row.totalCents,
			);
		}
		const series: ReportSeriesPoint[] = AGING_BUCKETS.map((bucket) => ({
			x: bucket,
			value: bucketTotals.get(bucket) ?? 0,
		}));

		return { kpis, series, rows, excluded };
	}
}

function monthsBetween(from: Date, to: Date): string[] {
	const months: string[] = [];
	let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
	const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
	while (cursor.getTime() <= end.getTime()) {
		months.push(monthKey(cursor));
		cursor = new Date(
			Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
		);
	}
	return months;
}
