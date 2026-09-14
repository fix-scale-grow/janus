import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { ForbiddenException } from "@nestjs/common";
import { ConversionService } from "../src/currency/conversion.service";
import { PermissionsService } from "../src/permissions/permissions.service";
import { ReportsService } from "../src/reports/reports.service";
import { agingBucket, fallbackDueAt } from "../src/reports/reports-logic";

const suffix = process.env.TEST_RUN_ID ?? "reports-money-spec";

const permissions = new PermissionsService(db);
const conversion = new ConversionService(db);
const service = new ReportsService(db, permissions, conversion);

let adminUserId: string;
let memberUserId: string;
let forbiddenUserId: string;
let seededStageId: string;

const dealIds: string[] = [];
const invoiceIds: string[] = [];

async function createDeal(id: string, name: string) {
	const deal = await db.deal.create({
		data: {
			id,
			name,
			ownerId: adminUserId,
			currency: "USD",
			stageId: seededStageId,
		},
		select: { id: true },
	});
	dealIds.push(deal.id);
	return deal.id;
}

async function createInvoice(data: {
	id: string;
	dealId?: string;
	status: "DRAFT" | "SENT" | "PAID" | "VOID";
	currency: string;
	issuedAt?: Date | null;
	dueAt?: Date | null;
	paidAt?: Date | null;
	createdAt?: Date;
	lineTotalCents: number;
}) {
	const invoice = await db.invoice.create({
		data: {
			id: data.id,
			dealId: data.dealId,
			status: data.status,
			currency: data.currency,
			issuedAt: data.issuedAt ?? undefined,
			dueAt: data.dueAt ?? undefined,
			paidAt: data.paidAt ?? undefined,
			createdAt: data.createdAt,
			createdById: adminUserId,
		},
		select: { id: true },
	});
	await db.invoiceLineItem.create({
		data: {
			invoiceId: invoice.id,
			name: "Line",
			unit: "PER_EACH",
			quantity: 1,
			priceCents: data.lineTotalCents,
			sortOrder: 0,
		},
	});
	invoiceIds.push(invoice.id);
	return invoice.id;
}

beforeAll(async () => {
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: "Test",
			slug: `ws-${suffix}`,
			createdAt: new Date(),
		},
	});

	const admin = await db.user.create({
		data: {
			id: `reports-money-admin-${suffix}`,
			name: "Reports Money Admin",
			email: `reports-money-admin-${suffix}@example.test`,
		},
		select: { id: true },
	});
	adminUserId = admin.id;

	const member = await db.user.create({
		data: {
			id: `reports-money-member-${suffix}`,
			name: "Reports Money Member",
			email: `reports-money-member-${suffix}@example.test`,
		},
		select: { id: true },
	});
	memberUserId = member.id;

	const forbidden = await db.user.create({
		data: {
			id: `reports-money-forbidden-${suffix}`,
			name: "Reports Money Forbidden",
			email: `reports-money-forbidden-${suffix}@example.test`,
		},
		select: { id: true },
	});
	forbiddenUserId = forbidden.id;

	await db.member.create({
		data: {
			id: `reports-money-admin-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: adminUserId,
			role: "admin",
			createdAt: new Date(),
		},
	});
	await db.member.create({
		data: {
			id: `reports-money-member-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: memberUserId,
			role: "member",
			createdAt: new Date(),
		},
	});
	await db.member.create({
		data: {
			id: `reports-money-forbidden-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: forbiddenUserId,
			role: "member",
			createdAt: new Date(),
		},
	});

	await permissions.grant(adminUserId, {
		userId: memberUserId,
		key: "profit.view",
	});

	const seededStage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	seededStageId = seededStage.id;
});

afterAll(async () => {
	await db.invoiceLineItem.deleteMany({
		where: { invoiceId: { in: invoiceIds } },
	});
	await db.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
	await db.jobCost.deleteMany({ where: { dealId: { in: dealIds } } });
	await db.dealContact.deleteMany({ where: { dealId: { in: dealIds } } });
	await db.deal.deleteMany({ where: { id: { in: dealIds } } });
	await db.contact.deleteMany({
		where: { id: { startsWith: `reports-money-contact-${suffix}` } },
	});
	await db.userPermission.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId, forbiddenUserId] } },
	});
	await db.member.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId, forbiddenUserId] } },
	});
	await db.user.deleteMany({
		where: { id: { in: [adminUserId, memberUserId, forbiddenUserId] } },
	});
});

describe("agingBucket pinned edges", () => {
	const now = new Date(Date.UTC(2026, 8, 14));

	it("due today is current", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 8, 14)), now)).toBe("current");
	});

	it("30 days past due is the 1-30 upper edge", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 7, 15)), now)).toBe("1-30");
	});

	it("31 days past due is 31-60", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 7, 14)), now)).toBe("31-60");
	});

	it("60 days past due is the 31-60 upper edge", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 6, 16)), now)).toBe("31-60");
	});

	it("61 days past due is 61-90", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 6, 15)), now)).toBe("61-90");
	});

	it("90 days past due is the 61-90 upper edge", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 5, 16)), now)).toBe("61-90");
	});

	it("91 days past due is 90+", () => {
		expect(agingBucket(new Date(Date.UTC(2026, 5, 15)), now)).toBe("90+");
	});
});

describe("fallbackDueAt", () => {
	it("keeps a real dueAt", () => {
		const dueAt = new Date("2020-01-15T00:00:00.000Z");
		const result = fallbackDueAt({
			dueAt,
			issuedAt: new Date("2020-01-01T00:00:00.000Z"),
			createdAt: new Date("2020-01-01T00:00:00.000Z"),
		});
		expect(result).toEqual(dueAt);
	});

	it("falls back to issuedAt plus 30 days", () => {
		const result = fallbackDueAt({
			dueAt: null,
			issuedAt: new Date("2020-01-01T00:00:00.000Z"),
			createdAt: new Date("2019-01-01T00:00:00.000Z"),
		});
		expect(result).toEqual(new Date("2020-01-31T00:00:00.000Z"));
	});

	it("falls back to createdAt plus 30 days when issuedAt is also null", () => {
		const result = fallbackDueAt({
			dueAt: null,
			issuedAt: null,
			createdAt: new Date("2020-02-01T00:00:00.000Z"),
		});
		expect(result).toEqual(new Date("2020-03-02T00:00:00.000Z"));
	});
});

describe("money report procs", () => {
	it("403s without profit.view", async () => {
		const range = {};
		for (const call of [
			() => service.jobProfitability(forbiddenUserId, range),
			() => service.profitOverTime(forbiddenUserId, range),
			() => service.costBreakdown(forbiddenUserId, range),
			() => service.arAging(forbiddenUserId, range),
		]) {
			let thrown: unknown;
			try {
				await call();
			} catch (error) {
				thrown = error;
			}
			expect(thrown).toBeInstanceOf(ForbiddenException);
		}
	});

	describe("jobProfitability", () => {
		const range = {
			from: new Date("2020-01-01T00:00:00.000Z"),
			to: new Date("2020-01-31T00:00:00.000Z"),
		};

		it("counts a two-contact deal once, primary contact is the older DealContact", async () => {
			const dealId = await createDeal(
				`reports-money-deal-two-contacts-${suffix}`,
				"Two Contact Deal",
			);

			const olderContact = await db.contact.create({
				data: {
					id: `reports-money-contact-${suffix}-older`,
					firstName: "Older",
					lastName: "Contact",
				},
				select: { id: true },
			});
			const newerContact = await db.contact.create({
				data: {
					id: `reports-money-contact-${suffix}-newer`,
					firstName: "Newer",
					lastName: "Contact",
				},
				select: { id: true },
			});

			await db.dealContact.create({
				data: {
					dealId,
					contactId: olderContact.id,
					createdAt: new Date("2019-01-01T00:00:00.000Z"),
				},
			});
			await db.dealContact.create({
				data: {
					dealId,
					contactId: newerContact.id,
					createdAt: new Date("2019-06-01T00:00:00.000Z"),
				},
			});

			await createInvoice({
				id: `reports-money-invoice-tc-sent-${suffix}`,
				dealId,
				status: "SENT",
				currency: "USD",
				issuedAt: new Date("2020-01-05T00:00:00.000Z"),
				lineTotalCents: 10000,
			});
			await createInvoice({
				id: `reports-money-invoice-tc-paid-${suffix}`,
				dealId,
				status: "PAID",
				currency: "USD",
				issuedAt: new Date("2020-01-10T00:00:00.000Z"),
				paidAt: new Date("2020-01-15T00:00:00.000Z"),
				lineTotalCents: 5000,
			});

			await db.jobCost.create({
				data: {
					dealId,
					date: new Date("2020-01-12T00:00:00.000Z"),
					amountCents: 2000,
					currency: "USD",
					category: "MATERIALS",
					createdById: adminUserId,
				},
			});

			const result = await service.jobProfitability(memberUserId, range);
			const matching = result.rows.filter((row) => row.dealId === dealId);
			expect(matching.length).toBe(1);

			const row = matching[0];
			if (!row) throw new Error("expected a row for the deal");
			expect(row.invoicedCents).toBe(15000);
			expect(row.collectedCents).toBe(5000);
			expect(row.costsCents).toBe(2000);
			expect(row.profitCents).toBe(13000);
			expect(row.collectedProfitCents).toBe(3000);
			expect(row.marginPct).not.toBeNull();
			expect(row.marginPct as number).toBeCloseTo((13000 / 15000) * 100, 5);
			expect(row.primaryContactId).toBe(olderContact.id);
			expect(row.primaryContactName).toBe("Older Contact");
		});

		it("breaks a tied createdAt on the lower contactId, stable across calls", async () => {
			const dealId = await createDeal(
				`reports-money-deal-tied-contacts-${suffix}`,
				"Tied Contact Deal",
			);

			const tiedCreatedAt = new Date("2019-03-01T00:00:00.000Z");
			const contactA = await db.contact.create({
				data: {
					id: `reports-money-contact-${suffix}-tied-a`,
					firstName: "Tied",
					lastName: "A",
				},
				select: { id: true },
			});
			const contactB = await db.contact.create({
				data: {
					id: `reports-money-contact-${suffix}-tied-b`,
					firstName: "Tied",
					lastName: "B",
				},
				select: { id: true },
			});
			const [lower, higher] =
				contactA.id < contactB.id ? [contactA, contactB] : [contactB, contactA];

			await db.dealContact.create({
				data: { dealId, contactId: higher.id, createdAt: tiedCreatedAt },
			});
			await db.dealContact.create({
				data: { dealId, contactId: lower.id, createdAt: tiedCreatedAt },
			});

			await createInvoice({
				id: `reports-money-invoice-tied-${suffix}`,
				dealId,
				status: "SENT",
				currency: "USD",
				issuedAt: new Date("2020-01-05T00:00:00.000Z"),
				lineTotalCents: 1000,
			});

			const first = await service.jobProfitability(memberUserId, range);
			const second = await service.jobProfitability(memberUserId, range);
			const firstRow = first.rows.find((row) => row.dealId === dealId);
			const secondRow = second.rows.find((row) => row.dealId === dealId);
			if (!firstRow || !secondRow) throw new Error("expected a row");

			expect(firstRow.primaryContactId).toBe(lower.id);
			expect(secondRow.primaryContactId).toBe(lower.id);
		});

		it("SENT invoice lands in invoiced only, PAID lands in invoiced and collected", async () => {
			const sentDealId = await createDeal(
				`reports-money-deal-sent-${suffix}`,
				"Sent Only Deal",
			);
			await createInvoice({
				id: `reports-money-invoice-sent-${suffix}`,
				dealId: sentDealId,
				status: "SENT",
				currency: "USD",
				issuedAt: new Date("2020-01-06T00:00:00.000Z"),
				lineTotalCents: 4000,
			});

			const paidDealId = await createDeal(
				`reports-money-deal-paid-${suffix}`,
				"Paid Only Deal",
			);
			await createInvoice({
				id: `reports-money-invoice-paid-${suffix}`,
				dealId: paidDealId,
				status: "PAID",
				currency: "USD",
				issuedAt: new Date("2020-01-07T00:00:00.000Z"),
				paidAt: new Date("2020-01-09T00:00:00.000Z"),
				lineTotalCents: 6000,
			});

			const draftVoidDealId = await createDeal(
				`reports-money-deal-draft-void-${suffix}`,
				"Draft Void Deal",
			);
			await createInvoice({
				id: `reports-money-invoice-draft-${suffix}`,
				dealId: draftVoidDealId,
				status: "DRAFT",
				currency: "USD",
				issuedAt: new Date("2020-01-08T00:00:00.000Z"),
				lineTotalCents: 9999,
			});
			await createInvoice({
				id: `reports-money-invoice-void-${suffix}`,
				dealId: draftVoidDealId,
				status: "VOID",
				currency: "USD",
				issuedAt: new Date("2020-01-08T00:00:00.000Z"),
				lineTotalCents: 8888,
			});

			const result = await service.jobProfitability(memberUserId, range);

			const sentRow = result.rows.find((row) => row.dealId === sentDealId);
			if (!sentRow) throw new Error("expected the sent deal to have a row");
			expect(sentRow.invoicedCents).toBe(4000);
			expect(sentRow.collectedCents).toBe(0);

			const paidRow = result.rows.find((row) => row.dealId === paidDealId);
			if (!paidRow) throw new Error("expected the paid deal to have a row");
			expect(paidRow.invoicedCents).toBe(6000);
			expect(paidRow.collectedCents).toBe(6000);

			expect(
				result.rows.find((row) => row.dealId === draftVoidDealId),
			).toBeUndefined();
		});

		it("counts a non-USD invoice and a non-USD cost as excluded, never into totals", async () => {
			const eurDealId = await createDeal(
				`reports-money-deal-eur-${suffix}`,
				"Eur Deal",
			);
			await createInvoice({
				id: `reports-money-invoice-eur-${suffix}`,
				dealId: eurDealId,
				status: "PAID",
				currency: "EUR",
				issuedAt: new Date("2020-01-20T00:00:00.000Z"),
				paidAt: new Date("2020-01-21T00:00:00.000Z"),
				lineTotalCents: 7000,
			});
			await db.jobCost.create({
				data: {
					dealId: eurDealId,
					date: new Date("2020-01-22T00:00:00.000Z"),
					amountCents: 3000,
					currency: "EUR",
					category: "LABOR",
					createdById: adminUserId,
				},
			});

			const before = await service.jobProfitability(memberUserId, {
				from: new Date("2020-01-19T00:00:00.000Z"),
				to: new Date("2020-01-19T00:00:00.000Z"),
			});
			const result = await service.jobProfitability(memberUserId, {
				from: new Date("2020-01-19T00:00:00.000Z"),
				to: new Date("2020-01-23T00:00:00.000Z"),
			});

			expect(
				result.rows.find((row) => row.dealId === eurDealId),
			).toBeUndefined();
			expect(result.excluded - before.excluded).toBe(2);
		});
	});

	describe("costBreakdown", () => {
		it("groups by category, deal and creator, and computes receiptCoveragePct", async () => {
			const dealId = await createDeal(
				`reports-money-deal-costs-${suffix}`,
				"Cost Breakdown Deal",
			);

			await db.jobCost.create({
				data: {
					dealId,
					date: new Date("2020-05-01T00:00:00.000Z"),
					amountCents: 1000,
					currency: "USD",
					category: "MATERIALS",
					receiptPath: "receipts/materials.pdf",
					createdById: adminUserId,
				},
			});
			await db.jobCost.create({
				data: {
					dealId,
					date: new Date("2020-05-02T00:00:00.000Z"),
					amountCents: 2000,
					currency: "USD",
					category: "LABOR",
					createdById: memberUserId,
				},
			});
			await db.jobCost.create({
				data: {
					dealId,
					date: new Date("2020-05-03T00:00:00.000Z"),
					amountCents: 500,
					currency: "EUR",
					category: "MATERIALS",
					receiptPath: "receipts/eur.pdf",
					createdById: adminUserId,
				},
			});

			const result = await service.costBreakdown(memberUserId, {
				from: new Date("2020-05-01T00:00:00.000Z"),
				to: new Date("2020-05-03T00:00:00.000Z"),
			});

			expect(result.excluded).toBe(1);
			expect(
				result.rows.find((row) => row.category === "MATERIALS")?.totalCents,
			).toBe(1000);
			expect(
				result.rows.find((row) => row.category === "LABOR")?.totalCents,
			).toBe(2000);
			expect(
				result.byDeal.find((row) => row.dealId === dealId)?.totalCents,
			).toBe(3000);
			expect(
				result.byCreator.find((row) => row.creatorId === adminUserId)
					?.totalCents,
			).toBe(1000);
			expect(
				result.byCreator.find((row) => row.creatorId === memberUserId)
					?.totalCents,
			).toBe(2000);

			const kpi = result.kpis.find((row) => row.key === "receiptCoverage");
			expect(kpi?.value).toBe("50%");
		});
	});

	describe("arAging", () => {
		const range = {
			from: new Date("2022-01-01T00:00:00.000Z"),
			to: new Date("2022-12-31T00:00:00.000Z"),
		};

		it("buckets outstanding SENT invoices, falls back dueAt, and computes avgDaysToPay", async () => {
			const now = new Date();
			const dealId = await createDeal(
				`reports-money-deal-ar-${suffix}`,
				"AR Aging Deal",
			);

			const currentDueAt = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
			);
			await createInvoice({
				id: `reports-money-invoice-ar-current-${suffix}`,
				dealId,
				status: "SENT",
				currency: "USD",
				issuedAt: new Date("2022-01-01T00:00:00.000Z"),
				dueAt: currentDueAt,
				lineTotalCents: 1000,
			});

			const overdueDueAt = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
			await createInvoice({
				id: `reports-money-invoice-ar-overdue-${suffix}`,
				dealId,
				status: "SENT",
				currency: "USD",
				issuedAt: new Date("2022-01-02T00:00:00.000Z"),
				dueAt: overdueDueAt,
				lineTotalCents: 2000,
			});

			const fallbackIssuedAt = new Date("2022-01-03T00:00:00.000Z");
			await createInvoice({
				id: `reports-money-invoice-ar-fallback-issued-${suffix}`,
				dealId,
				status: "SENT",
				currency: "USD",
				issuedAt: fallbackIssuedAt,
				dueAt: null,
				lineTotalCents: 3000,
			});

			const fallbackCreatedAt = new Date("2022-02-01T00:00:00.000Z");
			await createInvoice({
				id: `reports-money-invoice-ar-fallback-created-${suffix}`,
				dealId,
				status: "SENT",
				currency: "USD",
				issuedAt: null,
				dueAt: null,
				createdAt: fallbackCreatedAt,
				lineTotalCents: 4000,
			});

			await createInvoice({
				id: `reports-money-invoice-ar-eur-sent-${suffix}`,
				dealId,
				status: "SENT",
				currency: "EUR",
				issuedAt: new Date("2022-04-01T00:00:00.000Z"),
				lineTotalCents: 9000,
			});

			const paidIssuedAt = new Date("2022-03-01T00:00:00.000Z");
			const paidPaidAt = new Date("2022-03-08T00:00:00.000Z");
			await createInvoice({
				id: `reports-money-invoice-ar-paid-${suffix}`,
				dealId,
				status: "PAID",
				currency: "USD",
				issuedAt: paidIssuedAt,
				paidAt: paidPaidAt,
				lineTotalCents: 1500,
			});
			await createInvoice({
				id: `reports-money-invoice-ar-paid-eur-${suffix}`,
				dealId,
				status: "PAID",
				currency: "EUR",
				issuedAt: new Date("2022-04-02T00:00:00.000Z"),
				paidAt: new Date("2022-04-05T00:00:00.000Z"),
				lineTotalCents: 2500,
			});

			const result = await service.arAging(memberUserId, range);

			const currentRow = result.rows.find(
				(row) => row.invoiceId === `reports-money-invoice-ar-current-${suffix}`,
			);
			if (!currentRow) throw new Error("expected the current row");
			expect(currentRow.bucket).toBe("current");
			expect(currentRow.ageDays).toBeLessThanOrEqual(0);

			const overdueRow = result.rows.find(
				(row) => row.invoiceId === `reports-money-invoice-ar-overdue-${suffix}`,
			);
			if (!overdueRow) throw new Error("expected the overdue row");
			expect(overdueRow.bucket).toBe("90+");
			expect(overdueRow.ageDays).toBeGreaterThan(90);

			const fallbackIssuedRow = result.rows.find(
				(row) =>
					row.invoiceId ===
					`reports-money-invoice-ar-fallback-issued-${suffix}`,
			);
			if (!fallbackIssuedRow) throw new Error("expected the fallback row");
			expect(fallbackIssuedRow.dueAt).toBe(
				new Date(
					fallbackIssuedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
				).toISOString(),
			);

			const fallbackCreatedRow = result.rows.find(
				(row) =>
					row.invoiceId ===
					`reports-money-invoice-ar-fallback-created-${suffix}`,
			);
			if (!fallbackCreatedRow)
				throw new Error("expected the created-fallback row");
			expect(fallbackCreatedRow.dueAt).toBe(
				new Date(
					fallbackCreatedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
				).toISOString(),
			);

			expect(
				result.rows.find(
					(row) =>
						row.invoiceId === `reports-money-invoice-ar-eur-sent-${suffix}`,
				),
			).toBeUndefined();

			const outstandingTotal = [
				currentRow,
				overdueRow,
				fallbackIssuedRow,
				fallbackCreatedRow,
			].reduce((sum, row) => sum + row.totalCents, 0);
			expect(outstandingTotal).toBe(1000 + 2000 + 3000 + 4000);

			expect(result.excluded).toBeGreaterThanOrEqual(2);

			const avgDaysToPayKpi = result.kpis.find(
				(row) => row.key === "avgDaysToPay",
			);
			expect(avgDaysToPayKpi?.value).toBe("7.0");
		});
	});

	describe("profitOverTime", () => {
		it("returns a dense, zero-filled month series and excludes non-USD rows", async () => {
			const dealId = await createDeal(
				`reports-money-deal-pot-${suffix}`,
				"Profit Over Time Deal",
			);
			await createInvoice({
				id: `reports-money-invoice-pot-sent-${suffix}`,
				dealId,
				status: "SENT",
				currency: "USD",
				issuedAt: new Date("2020-06-05T00:00:00.000Z"),
				lineTotalCents: 3000,
			});
			await createInvoice({
				id: `reports-money-invoice-pot-paid-${suffix}`,
				dealId,
				status: "PAID",
				currency: "USD",
				issuedAt: new Date("2020-06-06T00:00:00.000Z"),
				paidAt: new Date("2020-08-10T00:00:00.000Z"),
				lineTotalCents: 5000,
			});
			await createInvoice({
				id: `reports-money-invoice-pot-eur-${suffix}`,
				dealId,
				status: "SENT",
				currency: "EUR",
				issuedAt: new Date("2020-06-07T00:00:00.000Z"),
				lineTotalCents: 7000,
			});
			await db.jobCost.create({
				data: {
					dealId,
					date: new Date("2020-07-15T00:00:00.000Z"),
					amountCents: 1200,
					currency: "USD",
					category: "MATERIALS",
					createdById: adminUserId,
				},
			});

			const result = await service.profitOverTime(memberUserId, {
				from: new Date("2020-06-01T00:00:00.000Z"),
				to: new Date("2020-08-31T00:00:00.000Z"),
			});

			expect(result.rows.map((row) => row.month)).toEqual([
				"2020-06",
				"2020-07",
				"2020-08",
			]);

			const june = result.rows.find((row) => row.month === "2020-06");
			expect(june?.invoicedCents).toBe(8000);
			expect(june?.collectedCents).toBe(0);
			expect(june?.costsCents).toBe(0);

			const july = result.rows.find((row) => row.month === "2020-07");
			expect(july?.invoicedCents).toBe(0);
			expect(july?.collectedCents).toBe(0);
			expect(july?.costsCents).toBe(1200);

			const august = result.rows.find((row) => row.month === "2020-08");
			expect(august?.invoicedCents).toBe(0);
			expect(august?.collectedCents).toBe(5000);
			expect(august?.costsCents).toBe(0);

			expect(result.excluded).toBeGreaterThanOrEqual(1);
		});
	});
});
