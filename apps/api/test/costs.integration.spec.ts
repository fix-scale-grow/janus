import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CostsService } from "../src/costs/costs.service";
import { PermissionsService } from "../src/permissions/permissions.service";

const suffix = process.env.TEST_RUN_ID ?? "costs-spec";

const permissions = new PermissionsService(db);
const service = new CostsService(db, permissions);

let adminUserId: string;
let memberUserId: string;
let dealId: string;
let secondDealId: string;
let seededStageId: string;

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
			id: `costs-admin-${suffix}`,
			name: "Costs Admin",
			email: `costs-admin-${suffix}@example.test`,
		},
		select: { id: true },
	});
	adminUserId = admin.id;

	const member = await db.user.create({
		data: {
			id: `costs-member-${suffix}`,
			name: "Costs Member",
			email: `costs-member-${suffix}@example.test`,
		},
		select: { id: true },
	});
	memberUserId = member.id;

	await db.member.create({
		data: {
			id: `costs-admin-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: adminUserId,
			role: "admin",
			createdAt: new Date(),
		},
	});

	await db.member.create({
		data: {
			id: `costs-member-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: memberUserId,
			role: "member",
			createdAt: new Date(),
		},
	});

	const seededStage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	seededStageId = seededStage.id;

	const deal = await db.deal.create({
		data: {
			id: `costs-deal-${suffix}`,
			name: `Costs Deal ${suffix}`,
			ownerId: adminUserId,
			currency: "USD",
			stageId: seededStageId,
		},
		select: { id: true },
	});
	dealId = deal.id;

	const secondDeal = await db.deal.create({
		data: {
			id: `costs-deal-2-${suffix}`,
			name: `Costs Deal 2 ${suffix}`,
			ownerId: adminUserId,
			currency: "EUR",
			stageId: seededStageId,
		},
		select: { id: true },
	});
	secondDealId = secondDeal.id;
});

afterAll(async () => {
	await db.jobCost.deleteMany({
		where: { dealId: { in: [dealId, secondDealId] } },
	});
	await db.invoiceLineItem.deleteMany({
		where: { invoice: { dealId: { in: [dealId, secondDealId] } } },
	});
	await db.invoice.deleteMany({
		where: { dealId: { in: [dealId, secondDealId] } },
	});
	await db.userPermission.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId] } },
	});
	await db.deal.deleteMany({ where: { id: { in: [dealId, secondDealId] } } });
	await db.member.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId] } },
	});
	await db.user.deleteMany({
		where: { id: { in: [adminUserId, memberUserId] } },
	});
});

describe("CostsService", () => {
	it("create copies the deal's currency", async () => {
		const createDealId = `costs-deal-create-${suffix}`;
		await db.deal.create({
			data: {
				id: createDealId,
				name: `Costs Deal Create ${suffix}`,
				ownerId: adminUserId,
				currency: "USD",
				stageId: seededStageId,
			},
		});

		const cost = await service.create(
			{
				dealId: createDealId,
				date: new Date("2026-09-01T00:00:00.000Z"),
				amountCents: 500,
				category: "MATERIALS",
			},
			adminUserId,
		);

		expect(cost.currency).toBe("USD");

		await db.jobCost.deleteMany({ where: { dealId: createDealId } });
		await db.deal.delete({ where: { id: createDealId } });
	});

	it("create throws NotFoundException when the deal is missing", async () => {
		let thrownError: unknown;
		try {
			await service.create(
				{
					dealId: "no-such-deal",
					date: new Date("2026-09-01T00:00:00.000Z"),
					amountCents: 500,
					category: "MATERIALS",
				},
				adminUserId,
			);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NotFoundException);
	});

	it("list returns the row plus totalsByCurrency and totalsByCategory", async () => {
		const listDealId = `costs-deal-list-${suffix}`;
		await db.deal.create({
			data: {
				id: listDealId,
				name: `Costs Deal List ${suffix}`,
				ownerId: adminUserId,
				currency: "USD",
				stageId: seededStageId,
			},
		});

		await service.create(
			{
				dealId: listDealId,
				date: new Date("2026-09-01T00:00:00.000Z"),
				amountCents: 700,
				category: "MATERIALS",
			},
			adminUserId,
		);
		await service.create(
			{
				dealId: listDealId,
				date: new Date("2026-09-02T00:00:00.000Z"),
				amountCents: 300,
				category: "LABOR",
			},
			adminUserId,
		);

		const result = await service.list({ dealId: listDealId });

		expect(result.rows.length).toBe(2);
		expect(result.totalsByCurrency).toEqual([
			{ currency: "USD", totalCents: 1000 },
		]);
		expect(
			result.totalsByCategory.sort((a, b) =>
				a.category.localeCompare(b.category),
			),
		).toEqual([
			{ category: "LABOR", currency: "USD", totalCents: 300 },
			{ category: "MATERIALS", currency: "USD", totalCents: 700 },
		]);

		await db.jobCost.deleteMany({ where: { dealId: listDealId } });
		await db.deal.delete({ where: { id: listDealId } });
	});

	it("profitForDeal computes byCurrency invoiced/collected/costs/profit/marginPct", async () => {
		const sentInvoice = await db.invoice.create({
			data: {
				status: "SENT",
				currency: "USD",
				dealId,
				createdById: adminUserId,
			},
			select: { id: true },
		});
		await db.invoiceLineItem.create({
			data: {
				invoiceId: sentInvoice.id,
				name: "Sent line",
				unit: "PER_EACH",
				quantity: 2,
				priceCents: 1000,
				sortOrder: 0,
			},
		});

		const paidInvoice = await db.invoice.create({
			data: {
				status: "PAID",
				currency: "USD",
				dealId,
				createdById: adminUserId,
			},
			select: { id: true },
		});
		await db.invoiceLineItem.create({
			data: {
				invoiceId: paidInvoice.id,
				name: "Paid line",
				unit: "PER_EACH",
				quantity: 1.5,
				priceCents: 1000,
				sortOrder: 0,
			},
		});

		const draftInvoice = await db.invoice.create({
			data: {
				status: "DRAFT",
				currency: "USD",
				dealId,
				createdById: adminUserId,
			},
			select: { id: true },
		});
		await db.invoiceLineItem.create({
			data: {
				invoiceId: draftInvoice.id,
				name: "Draft line",
				unit: "PER_EACH",
				quantity: 10,
				priceCents: 1000,
				sortOrder: 0,
			},
		});

		const voidInvoice = await db.invoice.create({
			data: {
				status: "VOID",
				currency: "USD",
				dealId,
				createdById: adminUserId,
			},
			select: { id: true },
		});
		await db.invoiceLineItem.create({
			data: {
				invoiceId: voidInvoice.id,
				name: "Void line",
				unit: "PER_EACH",
				quantity: 10,
				priceCents: 1000,
				sortOrder: 0,
			},
		});

		await service.create(
			{
				dealId,
				date: new Date("2026-09-01T00:00:00.000Z"),
				amountCents: 1200,
				category: "MATERIALS",
			},
			adminUserId,
		);

		await permissions.grant(adminUserId, {
			userId: memberUserId,
			key: "profit.view",
		});

		try {
			let thrownError: unknown;
			try {
				const forbiddenMember = `costs-forbidden-${suffix}`;
				const forbiddenUser = await db.user.create({
					data: {
						id: forbiddenMember,
						name: "Forbidden Member",
						email: `${forbiddenMember}@example.test`,
					},
					select: { id: true },
				});
				await db.member.create({
					data: {
						id: `costs-forbidden-row-${suffix}`,
						organizationId: WORKSPACE_ID,
						userId: forbiddenUser.id,
						role: "member",
						createdAt: new Date(),
					},
				});
				try {
					await service.profitForDeal(forbiddenUser.id, dealId);
				} catch (error) {
					thrownError = error;
				}
				expect(thrownError).toBeInstanceOf(ForbiddenException);
				await db.member.deleteMany({ where: { userId: forbiddenUser.id } });
				await db.user.deleteMany({ where: { id: forbiddenUser.id } });
			} catch (error) {
				throw error;
			}

			const result = await service.profitForDeal(memberUserId, dealId);

			expect(result.byCurrency.length).toBe(1);
			const usd = result.byCurrency[0];
			if (!usd) throw new Error("expected a USD byCurrency entry");
			expect(usd.currency).toBe("USD");
			expect(usd.invoicedCents).toBe(3500);
			expect(usd.collectedCents).toBe(1500);
			expect(usd.costsCents).toBe(1200);
			expect(usd.profitCents).toBe(2300);
			expect(usd.marginPct).not.toBeNull();
			expect(usd.marginPct as number).toBeCloseTo(65.7, 1);
		} finally {
			await permissions.revoke(adminUserId, {
				userId: memberUserId,
				key: "profit.view",
			});
		}
	});

	it("profitForDeal throws ForbiddenException without a grant, then succeeds after one", async () => {
		let thrownError: unknown;
		try {
			await service.profitForDeal(memberUserId, dealId);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).toBeInstanceOf(ForbiddenException);

		await db.userPermission.create({
			data: {
				userId: memberUserId,
				key: "profit.view",
				grantedById: adminUserId,
			},
		});

		const result = await service.profitForDeal(memberUserId, dealId);
		expect(result.byCurrency).toBeDefined();

		await db.userPermission.deleteMany({
			where: { userId: memberUserId, key: "profit.view" },
		});
	});

	it("a cost in a second currency shows up as its own byCurrency entry, never merged", async () => {
		const eurInvoice = await db.invoice.create({
			data: {
				status: "PAID",
				currency: "EUR",
				dealId: secondDealId,
				createdById: adminUserId,
			},
			select: { id: true },
		});
		await db.invoiceLineItem.create({
			data: {
				invoiceId: eurInvoice.id,
				name: "Eur line",
				unit: "PER_EACH",
				quantity: 1,
				priceCents: 5000,
				sortOrder: 0,
			},
		});

		await service.create(
			{
				dealId: secondDealId,
				date: new Date("2026-09-01T00:00:00.000Z"),
				amountCents: 1000,
				category: "LABOR",
			},
			adminUserId,
		);

		await db.userPermission.create({
			data: {
				userId: memberUserId,
				key: "profit.view",
				grantedById: adminUserId,
			},
		});

		const result = await service.profitForDeal(memberUserId, secondDealId);

		expect(result.byCurrency.length).toBe(1);
		const eur = result.byCurrency[0];
		if (!eur) throw new Error("expected a EUR byCurrency entry");
		expect(eur.currency).toBe("EUR");
		expect(eur.invoicedCents).toBe(5000);
		expect(eur.costsCents).toBe(1000);

		await db.userPermission.deleteMany({
			where: { userId: memberUserId, key: "profit.view" },
		});
	});

	it("profitForDeal marginPct is null when invoiced is 0", async () => {
		const zeroDealId = `costs-deal-zero-${suffix}`;
		await db.deal.create({
			data: {
				id: zeroDealId,
				name: `Costs Deal Zero ${suffix}`,
				ownerId: adminUserId,
				currency: "USD",
				stageId: seededStageId,
			},
		});

		await service.create(
			{
				dealId: zeroDealId,
				date: new Date("2026-09-01T00:00:00.000Z"),
				amountCents: 400,
				category: "OTHER",
			},
			adminUserId,
		);

		await db.userPermission.create({
			data: {
				userId: memberUserId,
				key: "profit.view",
				grantedById: adminUserId,
			},
		});

		const result = await service.profitForDeal(memberUserId, zeroDealId);
		expect(result.byCurrency.length).toBe(1);
		const zero = result.byCurrency[0];
		if (!zero) throw new Error("expected a byCurrency entry");
		expect(zero.invoicedCents).toBe(0);
		expect(zero.marginPct).toBeNull();

		await db.userPermission.deleteMany({
			where: { userId: memberUserId, key: "profit.view" },
		});
		await db.jobCost.deleteMany({ where: { dealId: zeroDealId } });
		await db.deal.delete({ where: { id: zeroDealId } });
	});
});
