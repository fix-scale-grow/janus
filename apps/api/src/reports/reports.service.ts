import { WORKSPACE_ID } from "@crm/auth";
import {
	ActivityType,
	type Db,
	InspectionResult,
	PermitStatus,
	ProductionStage,
	ProjectTaskStatus,
	RecordSource,
	StageOutcome,
} from "@crm/db";
import { Inject, Injectable } from "@nestjs/common";
import { toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { formatCents } from "../documents/pdf-money";
import { tierTotals } from "../estimates/estimate-pdf";
import { lineItemsTotalCents } from "../invoices/invoice-logic";
import { INVOICES } from "../invoices/invoices.config";
import { PERMISSION_KEYS } from "../permissions/permissions.config";
import { PermissionsService } from "../permissions/permissions.service";
import { spanDays, toDay } from "../projects/projects.contracts";
import { REPORTS } from "./reports.config";
import type {
	ArAgingRow,
	CostByCreatorRow,
	CostByDealRow,
	CostCategoryRow,
	EstimatesFunnel,
	EstimatesFunnelTierRow,
	JobProfitabilityRow,
	LeaderboardRow,
	LeadSourceRow,
	PermitExpiringRow,
	PermitJurisdictionCycleRow,
	PermitStatusCountRow,
	PipelineFunnel,
	PipelineLossReasonRow,
	PipelineStageFunnelRow,
	ProductionCrewRow,
	ProductionStageCountRow,
	ProductionThroughputRow,
	ProfitOverTimeRow,
	ReportKpi,
	ReportRangeInput,
	ReportSeriesPoint,
} from "./reports.contracts";
import { parseStageChangeMeta } from "./reports.contracts";
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
		private readonly conversion: ConversionService,
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
		const [deals, primaryContacts] = await Promise.all([
			dealIds.length
				? this.db.deal.findMany({
						where: { id: { in: dealIds } },
						select: { id: true, name: true, number: true },
					})
				: Promise.resolve([]),
			this.primaryContactsFor(dealIds),
		]);

		const rows: JobProfitabilityRow[] = deals
			.map((deal) => {
				const value = bucket(deal.id);
				const profitCents = value.invoicedCents - value.costsCents;
				const collectedProfitCents = value.collectedCents - value.costsCents;
				const primary = primaryContacts.get(deal.id) ?? null;
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

	private defaultRange(input: ReportRangeInput): { from: Date; to: Date } {
		const now = new Date();
		return {
			from: input.from ?? monthStart(now, REPORTS.trailingMonths - 1),
			to: input.to ?? now,
		};
	}

	private async primaryContactsFor(
		dealIds: string[],
	): Promise<
		Map<
			string,
			{ id: string; firstName: string; lastName: string | null } | null
		>
	> {
		if (dealIds.length === 0) return new Map();

		const deals = await this.db.deal.findMany({
			where: { id: { in: dealIds } },
			select: {
				id: true,
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
		});

		return new Map(
			deals.map((deal) => [deal.id, deal.contacts[0]?.contact ?? null]),
		);
	}

	async leaderboard(userId: string, input: ReportRangeInput) {
		const hasProfitView = await this.permissions.hasPermission(
			userId,
			PERMISSION_KEYS.profitView,
		);
		const { from, to } = this.defaultRange(input);
		const base = await this.conversion.reportingCurrency();

		const [members, stages] = await Promise.all([
			this.db.member.findMany({
				where: { organizationId: WORKSPACE_ID },
				select: { user: { select: { id: true, name: true } } },
			}),
			this.db.stage.findMany({ select: { id: true, outcome: true } }),
		]);

		const wonStageIds = stages
			.filter((stage) => stage.outcome === StageOutcome.WON)
			.map((stage) => stage.id);
		const lostStageIds = stages
			.filter((stage) => stage.outcome === StageOutcome.LOST)
			.map((stage) => stage.id);
		const openStageIds = stages
			.filter((stage) => stage.outcome === StageOutcome.OPEN)
			.map((stage) => stage.id);
		const ownerIds = members.map((member) => member.user.id);

		const [wonDeals, lostCounts, openCounts, activityCounts] =
			await Promise.all([
				this.db.deal.findMany({
					where: {
						ownerId: { in: ownerIds },
						stageId: { in: wonStageIds },
						closedAt: { gte: from, lte: to },
					},
					select: { ownerId: true, baseAmount: true, baseCurrency: true },
				}),
				this.db.deal.groupBy({
					by: ["ownerId"],
					where: {
						ownerId: { in: ownerIds },
						stageId: { in: lostStageIds },
						closedAt: { gte: from, lte: to },
					},
					_count: { _all: true },
				}),
				this.db.deal.groupBy({
					by: ["ownerId"],
					where: { ownerId: { in: ownerIds }, stageId: { in: openStageIds } },
					_count: { _all: true },
				}),
				this.db.activity.groupBy({
					by: ["createdById"],
					where: {
						createdById: { in: ownerIds },
						occurredAt: { gte: from, lte: to },
					},
					_count: { _all: true },
				}),
			]);

		let excluded = 0;
		const wonByOwner = new Map<
			string,
			{ wonCents: number; wonCount: number }
		>();
		for (const deal of wonDeals) {
			const entry = wonByOwner.get(deal.ownerId) ?? {
				wonCents: 0,
				wonCount: 0,
			};
			entry.wonCount += 1;
			if (deal.baseCurrency === base) {
				entry.wonCents += toCents(deal.baseAmount) ?? 0;
			} else {
				excluded += 1;
			}
			wonByOwner.set(deal.ownerId, entry);
		}
		const lostByOwner = new Map(
			lostCounts.map((row) => [row.ownerId, row._count._all]),
		);
		const openByOwner = new Map(
			openCounts.map((row) => [row.ownerId, row._count._all]),
		);
		const activityByOwner = new Map(
			activityCounts.map((row) => [row.createdById, row._count._all]),
		);

		const rows: LeaderboardRow[] = members
			.map((member) => {
				const won = wonByOwner.get(member.user.id) ?? {
					wonCents: 0,
					wonCount: 0,
				};
				const lost = lostByOwner.get(member.user.id) ?? 0;
				const decided = won.wonCount + lost;
				return {
					userId: member.user.id,
					name: member.user.name,
					wonCents: hasProfitView ? won.wonCents : null,
					wonCount: won.wonCount,
					openCount: openByOwner.get(member.user.id) ?? 0,
					winRatePct: decided > 0 ? (won.wonCount / decided) * 100 : null,
					activitiesLogged: activityByOwner.get(member.user.id) ?? 0,
				};
			})
			.sort((a, b) => b.wonCount - a.wonCount);

		const totalWonCents = rows.reduce(
			(sum, row) => sum + (row.wonCents ?? 0),
			0,
		);
		const totalWonCount = rows.reduce((sum, row) => sum + row.wonCount, 0);
		const totalActivities = rows.reduce(
			(sum, row) => sum + row.activitiesLogged,
			0,
		);

		const kpis: ReportKpi[] = [
			{ key: "wonCount", label: "Deals won", value: String(totalWonCount) },
			{
				key: "wonCents",
				label: "Won value",
				value: hasProfitView ? formatCents(totalWonCents, "USD") : "—",
			},
			{
				key: "activities",
				label: "Activities logged",
				value: String(totalActivities),
			},
		];

		const series: ReportSeriesPoint[] = rows.map((row) => ({
			x: row.name,
			value: hasProfitView ? (row.wonCents ?? 0) : row.wonCount,
		}));

		return { kpis, series, rows, excluded };
	}

	private async estimatesFunnelSection(
		from: Date,
		to: Date,
		hasProfitView: boolean,
	): Promise<{ estimatesFunnel: EstimatesFunnel; excluded: number }> {
		const estimates = await this.db.estimate.findMany({
			where: {
				status: { not: "DRAFT" },
				createdAt: { gte: from, lte: to },
			},
			select: {
				status: true,
				currency: true,
				selectedTier: true,
				createdAt: true,
				updatedAt: true,
				lineItems: {
					select: {
						name: true,
						unit: true,
						areaLabel: true,
						quantity: true,
						priceGoodCents: true,
						priceBetterCents: true,
						priceBestCents: true,
					},
				},
			},
		});

		const sentCount = estimates.length;
		const acceptedRows = estimates.filter((row) => row.status === "ACCEPTED");
		const declinedRows = estimates.filter((row) => row.status === "DECLINED");

		let excluded = 0;
		const byTier = new Map<string, { count: number; valueCents: number }>();
		for (const row of acceptedRows) {
			const tierBucket = byTier.get(row.selectedTier) ?? {
				count: 0,
				valueCents: 0,
			};
			tierBucket.count += 1;
			if (row.currency === "USD") {
				const totals = tierTotals(
					row.lineItems.map((item) => ({
						...item,
						quantity: Number(item.quantity),
					})),
				);
				tierBucket.valueCents += totals[row.selectedTier];
			} else {
				excluded += 1;
			}
			byTier.set(row.selectedTier, tierBucket);
		}

		const byTierRows: EstimatesFunnelTierRow[] = [...byTier.entries()].map(
			([tier, value]) => ({
				tier,
				count: value.count,
				valueCents: hasProfitView ? value.valueCents : null,
			}),
		);

		const acceptRatePct =
			sentCount > 0 ? (acceptedRows.length / sentCount) * 100 : null;

		const daysToAccept = acceptedRows.map(
			(row) => (row.updatedAt.getTime() - row.createdAt.getTime()) / DAY_MS,
		);
		const avgDaysToAccept = daysToAccept.length
			? daysToAccept.reduce((sum, value) => sum + value, 0) /
				daysToAccept.length
			: null;

		return {
			estimatesFunnel: {
				sentCount,
				acceptedCount: acceptedRows.length,
				declinedCount: declinedRows.length,
				acceptRatePct,
				byTier: byTierRows,
				avgDaysToAccept,
			},
			excluded,
		};
	}

	async pipeline(userId: string, input: ReportRangeInput) {
		const hasProfitView = await this.permissions.hasPermission(
			userId,
			PERMISSION_KEYS.profitView,
		);
		const { from, to } = this.defaultRange(input);

		const pipelines = await this.db.pipeline.findMany({
			where: { archivedAt: null },
			orderBy: { position: "asc" },
			select: { id: true, name: true },
		});

		const stagesByPipeline = pipelines.length
			? await this.db.stage.findMany({
					where: {
						pipelineId: { in: pipelines.map((pipeline) => pipeline.id) },
						archivedAt: null,
					},
					orderBy: [{ pipelineId: "asc" }, { position: "asc" }],
					select: {
						id: true,
						pipelineId: true,
						key: true,
						label: true,
						outcome: true,
					},
				})
			: [];

		const activities = await this.db.activity.findMany({
			where: {
				type: ActivityType.STAGE_CHANGE,
				occurredAt: { gte: from, lte: to },
			},
			orderBy: [{ dealId: "asc" }, { occurredAt: "asc" }],
			take: REPORTS.maxVelocityActivities,
			select: { dealId: true, occurredAt: true, meta: true },
		});

		type ParsedChange = { dealId: string; occurredAt: Date; to: string };
		const parsed: ParsedChange[] = [];
		for (const activity of activities) {
			if (!activity.dealId || !activity.occurredAt) continue;
			const meta = parseStageChangeMeta(activity.meta);
			if (!meta) continue;
			parsed.push({
				dealId: activity.dealId,
				occurredAt: activity.occurredAt,
				to: meta.to,
			});
		}

		const dealIds = [...new Set(parsed.map((change) => change.dealId))];
		const deals = dealIds.length
			? await this.db.deal.findMany({
					where: { id: { in: dealIds } },
					select: { id: true, stage: { select: { pipelineId: true } } },
				})
			: [];
		const pipelineByDeal = new Map(
			deals.map((deal) => [deal.id, deal.stage.pipelineId]),
		);

		const dealsByStage = new Map<string, Set<string>>();
		const gapsByStage = new Map<string, number[]>();
		const changesByDeal = new Map<string, ParsedChange[]>();
		for (const change of parsed) {
			const list = changesByDeal.get(change.dealId) ?? [];
			list.push(change);
			changesByDeal.set(change.dealId, list);
		}

		for (const change of parsed) {
			const pipelineId = pipelineByDeal.get(change.dealId);
			if (!pipelineId) continue;
			const key = `${pipelineId} ${change.to}`;
			const set = dealsByStage.get(key) ?? new Set<string>();
			set.add(change.dealId);
			dealsByStage.set(key, set);
		}

		for (const [dealId, changes] of changesByDeal) {
			const pipelineId = pipelineByDeal.get(dealId);
			if (!pipelineId) continue;
			for (let index = 0; index < changes.length - 1; index += 1) {
				const current = changes[index];
				const next = changes[index + 1];
				if (!current || !next) continue;
				const days =
					(next.occurredAt.getTime() - current.occurredAt.getTime()) / DAY_MS;
				const key = `${pipelineId} ${current.to}`;
				const list = gapsByStage.get(key) ?? [];
				list.push(days);
				gapsByStage.set(key, list);
			}
		}

		const lossStageIds = stagesByPipeline
			.filter((stage) => stage.outcome === StageOutcome.LOST)
			.map((stage) => stage.id);
		const lossRows = lossStageIds.length
			? await this.db.deal.groupBy({
					by: ["stageId", "closedReason"],
					where: {
						stageId: { in: lossStageIds },
						closedAt: { gte: from, lte: to },
					},
					_count: { _all: true },
				})
			: [];
		const lossByStage = new Map<string, Map<string, number>>();
		for (const row of lossRows) {
			const reason = row.closedReason ?? "Unspecified";
			const byReason =
				lossByStage.get(row.stageId) ?? new Map<string, number>();
			byReason.set(reason, (byReason.get(reason) ?? 0) + row._count._all);
			lossByStage.set(row.stageId, byReason);
		}

		const pipelineFunnels: PipelineFunnel[] = pipelines.map((pipeline) => {
			const stages = stagesByPipeline.filter(
				(stage) => stage.pipelineId === pipeline.id,
			);
			let previousCount: number | null = null;
			const stageRows: PipelineStageFunnelRow[] = stages.map((stage) => {
				const key = `${pipeline.id} ${stage.key}`;
				const count = dealsByStage.get(key)?.size ?? 0;
				const conversionPct =
					previousCount !== null && previousCount > 0
						? (count / previousCount) * 100
						: null;
				previousCount = count;
				const gaps = gapsByStage.get(key) ?? [];
				const avgDaysInStage = gaps.length
					? gaps.reduce((sum, value) => sum + value, 0) / gaps.length
					: null;
				return {
					stageId: stage.id,
					stageKey: stage.key,
					stageLabel: stage.label,
					outcome: stage.outcome,
					count,
					conversionPct,
					avgDaysInStage,
				};
			});

			const lossReasons: PipelineLossReasonRow[] = [];
			for (const stage of stages) {
				const byReason = lossByStage.get(stage.id);
				if (!byReason) continue;
				for (const [reason, count] of byReason) {
					lossReasons.push({ reason, count });
				}
			}

			return {
				pipelineId: pipeline.id,
				pipelineName: pipeline.name,
				stages: stageRows,
				lossReasons,
			};
		});

		const { estimatesFunnel, excluded } = await this.estimatesFunnelSection(
			from,
			to,
			hasProfitView,
		);

		const kpis: ReportKpi[] = [
			{
				key: "estimatesSent",
				label: "Estimates sent",
				value: String(estimatesFunnel.sentCount),
			},
			{
				key: "acceptRate",
				label: "Estimate accept rate",
				value:
					estimatesFunnel.acceptRatePct === null
						? "—"
						: `${estimatesFunnel.acceptRatePct.toFixed(1)}%`,
			},
			{
				key: "avgDaysToAccept",
				label: "Avg days to accept",
				value:
					estimatesFunnel.avgDaysToAccept === null
						? "—"
						: estimatesFunnel.avgDaysToAccept.toFixed(1),
			},
		];

		const series: ReportSeriesPoint[] = pipelineFunnels.flatMap((pipeline) =>
			pipeline.stages.map((stage) => ({
				x: `${pipeline.pipelineName}: ${stage.stageLabel}`,
				value: stage.count,
			})),
		);

		return {
			kpis,
			series,
			pipelines: pipelineFunnels,
			estimatesFunnel,
			excluded,
		};
	}

	async leadSources(userId: string, input: ReportRangeInput) {
		const hasProfitView = await this.permissions.hasPermission(
			userId,
			PERMISSION_KEYS.profitView,
		);
		const { from, to } = this.defaultRange(input);
		const base = await this.conversion.reportingCurrency();

		const contacts = await this.db.contact.findMany({
			where: { createdAt: { gte: from, lte: to } },
			select: { id: true, source: true },
		});
		const contactById = new Map(
			contacts.map((contact) => [contact.id, contact]),
		);
		const contactIds = contacts.map((contact) => contact.id);

		const trackingIds = contacts
			.filter((contact) => contact.source === RecordSource.TRACKING)
			.map((contact) => contact.id);
		const visitors = trackingIds.length
			? await this.db.trackedVisitor.findMany({
					where: { contactId: { in: trackingIds } },
					select: { contactId: true, firstSource: true },
				})
			: [];
		const trackedLabelByContact = new Map<string, string>();
		for (const visitor of visitors) {
			if (
				visitor.contactId &&
				visitor.firstSource &&
				!trackedLabelByContact.has(visitor.contactId)
			) {
				trackedLabelByContact.set(visitor.contactId, visitor.firstSource);
			}
		}

		const formIds = contacts
			.filter((contact) => contact.source === RecordSource.FORM)
			.map((contact) => contact.id);
		const submissions = formIds.length
			? await this.db.formSubmission.findMany({
					where: { contactId: { in: formIds }, formId: { not: null } },
					orderBy: { createdAt: "asc" },
					select: { contactId: true, form: { select: { name: true } } },
				})
			: [];
		const formLabelByContact = new Map<string, string>();
		for (const submission of submissions) {
			if (
				submission.contactId &&
				submission.form &&
				!formLabelByContact.has(submission.contactId)
			) {
				formLabelByContact.set(submission.contactId, submission.form.name);
			}
		}

		const labelFor = (contact: { id: string; source: string }): string => {
			if (contact.source === RecordSource.TRACKING) {
				return trackedLabelByContact.get(contact.id) ?? RecordSource.TRACKING;
			}
			if (contact.source === RecordSource.FORM) {
				return formLabelByContact.get(contact.id) ?? RecordSource.FORM;
			}
			return contact.source;
		};

		const contactBuckets = new Map<string, Set<string>>();
		for (const contact of contacts) {
			const label = labelFor(contact);
			const set = contactBuckets.get(label) ?? new Set<string>();
			set.add(contact.id);
			contactBuckets.set(label, set);
		}

		const dealContacts = contactIds.length
			? await this.db.dealContact.findMany({
					where: { contactId: { in: contactIds } },
					select: { dealId: true },
				})
			: [];
		const dealIds = [...new Set(dealContacts.map((row) => row.dealId))];

		const [deals, primaryContacts] = await Promise.all([
			dealIds.length
				? this.db.deal.findMany({
						where: { id: { in: dealIds }, createdAt: { gte: from, lte: to } },
						select: {
							id: true,
							closedAt: true,
							baseAmount: true,
							baseCurrency: true,
							stage: { select: { outcome: true } },
						},
					})
				: Promise.resolve([]),
			this.primaryContactsFor(dealIds),
		]);

		let excluded = 0;
		const dealCountByLabel = new Map<string, number>();
		const wonCountByLabel = new Map<string, number>();
		const wonCentsByLabel = new Map<string, number>();

		for (const deal of deals) {
			const primary = primaryContacts.get(deal.id);
			if (!primary) continue;
			const contact = contactById.get(primary.id);
			if (!contact) continue;
			const label = labelFor(contact);
			dealCountByLabel.set(label, (dealCountByLabel.get(label) ?? 0) + 1);

			const won =
				deal.stage.outcome === StageOutcome.WON &&
				deal.closedAt !== null &&
				deal.closedAt >= from &&
				deal.closedAt <= to;
			if (!won) continue;
			wonCountByLabel.set(label, (wonCountByLabel.get(label) ?? 0) + 1);
			if (deal.baseCurrency === base) {
				wonCentsByLabel.set(
					label,
					(wonCentsByLabel.get(label) ?? 0) + (toCents(deal.baseAmount) ?? 0),
				);
			} else {
				excluded += 1;
			}
		}

		const rows: LeadSourceRow[] = [...contactBuckets.entries()]
			.map(([source, set]) => ({
				source,
				contacts: set.size,
				deals: dealCountByLabel.get(source) ?? 0,
				wonCount: wonCountByLabel.get(source) ?? 0,
				wonCents: hasProfitView ? (wonCentsByLabel.get(source) ?? 0) : null,
			}))
			.sort((a, b) => b.contacts - a.contacts);

		const kpis: ReportKpi[] = [
			{
				key: "contacts",
				label: "Contacts",
				value: String(rows.reduce((sum, row) => sum + row.contacts, 0)),
			},
			{
				key: "deals",
				label: "Deals",
				value: String(rows.reduce((sum, row) => sum + row.deals, 0)),
			},
			{
				key: "won",
				label: "Won",
				value: String(rows.reduce((sum, row) => sum + row.wonCount, 0)),
			},
		];

		const series: ReportSeriesPoint[] = rows.map((row) => ({
			x: row.source,
			value: row.contacts,
		}));

		return { kpis, series, rows, excluded };
	}

	async production(_userId: string, input: ReportRangeInput) {
		const { from, to } = this.defaultRange(input);

		const [stageCounts, throughputRows, crews] = await Promise.all([
			this.db.deal.groupBy({
				by: ["productionStage"],
				where: { productionStage: { not: null } },
				_count: { _all: true },
			}),
			this.db.deal.findMany({
				where: {
					productionStage: {
						in: [ProductionStage.COMPLETE, ProductionStage.PAID],
					},
					productionStageChangedAt: { gte: from, lte: to },
				},
				select: { productionStageChangedAt: true },
			}),
			this.db.crew.findMany({
				where: { archived: false },
				select: { id: true, name: true, color: true },
			}),
		]);

		const throughputByMonth = new Map<string, number>();
		for (const deal of throughputRows) {
			if (!deal.productionStageChangedAt) continue;
			const key = monthKey(deal.productionStageChangedAt);
			throughputByMonth.set(key, (throughputByMonth.get(key) ?? 0) + 1);
		}
		const months = monthsBetween(from, to);
		const throughput: ProductionThroughputRow[] = months.map((month) => ({
			month,
			count: throughputByMonth.get(month) ?? 0,
		}));

		const crewIds = crews.map((crew) => crew.id);
		const tasks = crewIds.length
			? await this.db.projectTask.findMany({
					where: {
						crewId: { in: crewIds },
						startDay: { not: null, lte: to },
						OR: [{ endDay: null }, { endDay: { gte: from } }],
					},
					select: {
						crewId: true,
						startDay: true,
						endDay: true,
						status: true,
					},
				})
			: [];

		const crewRows: ProductionCrewRow[] = crews.map((crew) => {
			const crewTasks = tasks.filter((task) => task.crewId === crew.id);
			let taskDays = 0;
			let doneCount = 0;
			let openCount = 0;
			for (const task of crewTasks) {
				if (!task.startDay) continue;
				const start = task.startDay > from ? task.startDay : from;
				const endSource = task.endDay ?? task.startDay;
				const end = endSource < to ? endSource : to;
				if (end >= start) taskDays += spanDays(start, end);
				if (task.status === ProjectTaskStatus.DONE) doneCount += 1;
				else openCount += 1;
			}
			return {
				crewId: crew.id,
				name: crew.name,
				color: crew.color,
				taskCount: crewTasks.length,
				taskDays,
				doneCount,
				openCount,
			};
		});

		const stageCountRows: ProductionStageCountRow[] = stageCounts
			.filter((row) => row.productionStage !== null)
			.map((row) => ({
				stage: row.productionStage as string,
				count: row._count._all,
			}));

		const kpis: ReportKpi[] = [
			{
				key: "inProduction",
				label: "In production",
				value: String(stageCountRows.reduce((sum, row) => sum + row.count, 0)),
			},
			{
				key: "avgScheduledToComplete",
				label: "Avg scheduled to complete days",
				value: "—",
			},
		];

		const series: ReportSeriesPoint[] = stageCountRows.map((row) => ({
			x: row.stage,
			value: row.count,
		}));

		return {
			kpis,
			series,
			stageCounts: stageCountRows,
			throughputByMonth: throughput,
			avgScheduledToCompleteDays: null,
			crews: crewRows,
		};
	}

	async permits(userId: string, input: ReportRangeInput) {
		const hasProfitView = await this.permissions.hasPermission(
			userId,
			PERMISSION_KEYS.profitView,
		);
		const { from, to } = this.defaultRange(input);
		const now = new Date();
		const expiringWindowEnd = new Date(
			now.getTime() + REPORTS.expiringWindowDays * DAY_MS,
		);

		const [statusGroups, cycleRows, inspections, feesRows, expiring] =
			await Promise.all([
				this.db.permit.groupBy({ by: ["status"], _count: { _all: true } }),
				this.db.permit.findMany({
					where: {
						submittedAt: { not: null },
						issuedAt: { gte: from, lte: to },
					},
					select: {
						submittedAt: true,
						issuedAt: true,
						jurisdictionId: true,
						jurisdiction: { select: { name: true } },
					},
				}),
				this.db.permitInspection.findMany({
					where: { scheduledFor: { gte: from, lte: to } },
					select: { result: true },
				}),
				this.db.permit.findMany({
					where: {
						submittedAt: { gte: from, lte: to },
						feeCents: { not: null },
					},
					select: { feeCents: true },
				}),
				this.db.permit.findMany({
					where: {
						status: { in: [PermitStatus.ISSUED, PermitStatus.INSPECTIONS] },
						expiresAt: { lte: expiringWindowEnd },
					},
					select: {
						id: true,
						dealId: true,
						deal: { select: { name: true } },
						permitType: true,
						expiresAt: true,
					},
				}),
			]);

		const statusCounts: PermitStatusCountRow[] = statusGroups.map((row) => ({
			status: row.status,
			count: row._count._all,
		}));

		const byJurisdiction = new Map<
			string,
			{ name: string; sumDays: number; count: number }
		>();
		for (const permit of cycleRows) {
			if (!permit.submittedAt || !permit.issuedAt) continue;
			const days =
				(permit.issuedAt.getTime() - permit.submittedAt.getTime()) / DAY_MS;
			const value = byJurisdiction.get(permit.jurisdictionId) ?? {
				name: permit.jurisdiction.name,
				sumDays: 0,
				count: 0,
			};
			value.sumDays += days;
			value.count += 1;
			byJurisdiction.set(permit.jurisdictionId, value);
		}
		const cycleDaysByJurisdiction: PermitJurisdictionCycleRow[] = [
			...byJurisdiction.entries(),
		].map(([jurisdictionId, value]) => ({
			jurisdictionId,
			jurisdictionName: value.name,
			avgDays: value.sumDays / value.count,
		}));

		const passed = inspections.filter(
			(row) => row.result === InspectionResult.PASSED,
		).length;
		const failed = inspections.filter(
			(row) => row.result === InspectionResult.FAILED,
		).length;
		const inspectionPassRatePct =
			passed + failed > 0 ? (passed / (passed + failed)) * 100 : null;

		const feesTotalCents = feesRows.reduce(
			(sum, row) => sum + (row.feeCents ?? 0),
			0,
		);

		const expiringRows: PermitExpiringRow[] = expiring.map((permit) => ({
			permitId: permit.id,
			dealId: permit.dealId,
			dealName: permit.deal.name,
			permitType: permit.permitType,
			expiresAt: permit.expiresAt ? permit.expiresAt.toISOString() : "",
		}));

		const kpis: ReportKpi[] = [
			{
				key: "totalPermits",
				label: "Total permits",
				value: String(statusCounts.reduce((sum, row) => sum + row.count, 0)),
			},
			{
				key: "inspectionPassRate",
				label: "Inspection pass rate",
				value:
					inspectionPassRatePct === null
						? "—"
						: `${inspectionPassRatePct.toFixed(1)}%`,
			},
			{
				key: "fees",
				label: "Fees",
				value: hasProfitView ? formatCents(feesTotalCents, "USD") : "—",
			},
			{
				key: "expiringSoon",
				label: "Expiring soon",
				value: String(expiringRows.length),
			},
		];

		const series: ReportSeriesPoint[] = statusCounts.map((row) => ({
			x: row.status,
			value: row.count,
		}));

		return {
			kpis,
			series,
			statusCounts,
			cycleDaysByJurisdiction,
			inspectionPassRatePct,
			feesCents: hasProfitView ? feesTotalCents : null,
			expiring: expiringRows,
		};
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
