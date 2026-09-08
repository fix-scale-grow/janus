import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { ForbiddenException } from "@nestjs/common";
import { PermissionsService } from "../src/permissions/permissions.service";
import { toDay } from "../src/projects/projects.contracts";
import { ReportsService } from "../src/reports/reports.service";

const suffix = process.env.TEST_RUN_ID ?? "reports-spec";

const permissions = new PermissionsService(db);
const service = new ReportsService(db, permissions);

let adminUserId: string;
let memberUserId: string;
let dealId: string;
let contactId: string;
let secondContactId: string;
let invoiceId: string;
let jobCostId: string;

const today = toDay(new Date());
const currentMonth = today.toISOString().slice(0, 7);

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
			id: `reports-admin-${suffix}`,
			name: "Reports Admin",
			email: `reports-admin-${suffix}@example.test`,
		},
		select: { id: true },
	});
	adminUserId = admin.id;

	const member = await db.user.create({
		data: {
			id: `reports-member-${suffix}`,
			name: "Reports Member",
			email: `reports-member-${suffix}@example.test`,
		},
		select: { id: true },
	});
	memberUserId = member.id;

	await db.member.create({
		data: {
			id: `reports-admin-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: adminUserId,
			role: "admin",
			createdAt: new Date(),
		},
	});

	await db.member.create({
		data: {
			id: `reports-member-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: memberUserId,
			role: "member",
			createdAt: new Date(),
		},
	});

	const contact = await db.contact.create({
		data: {
			id: `reports-contact-${suffix}`,
			firstName: "Pat",
			lastName: `Client-${suffix}`,
		},
		select: { id: true },
	});
	contactId = contact.id;

	const secondContact = await db.contact.create({
		data: {
			id: `reports-contact-2-${suffix}`,
			firstName: "Sam",
			lastName: `Cosigner-${suffix}`,
		},
		select: { id: true },
	});
	secondContactId = secondContact.id;

	const seededStage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});

	const deal = await db.deal.create({
		data: {
			id: `reports-deal-${suffix}`,
			name: `Reports Deal ${suffix}`,
			ownerId: adminUserId,
			currency: "USD",
			stageId: seededStage.id,
		},
		select: { id: true },
	});
	dealId = deal.id;

	await db.dealContact.create({
		data: { dealId, contactId },
	});
	await db.dealContact.create({
		data: { dealId, contactId: secondContactId },
	});

	const invoice = await db.invoice.create({
		data: {
			status: "SENT",
			currency: "USD",
			dealId,
			createdById: adminUserId,
		},
		select: { id: true },
	});
	invoiceId = invoice.id;

	await db.invoiceLineItem.create({
		data: {
			invoiceId,
			name: "Line",
			unit: "PER_EACH",
			quantity: 5,
			priceCents: 1000,
			sortOrder: 0,
		},
	});

	const jobCost = await db.jobCost.create({
		data: {
			dealId,
			date: today,
			amountCents: 2000,
			currency: "USD",
			category: "MATERIALS",
			createdById: adminUserId,
		},
		select: { id: true },
	});
	jobCostId = jobCost.id;
});

afterAll(async () => {
	await db.jobCost.deleteMany({ where: { id: jobCostId } });
	await db.invoiceLineItem.deleteMany({ where: { invoiceId } });
	await db.invoice.deleteMany({ where: { id: invoiceId } });
	await db.dealContact.deleteMany({ where: { dealId } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.contact.deleteMany({
		where: { id: { in: [contactId, secondContactId] } },
	});
	await db.userPermission.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId] } },
	});
	await db.member.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId] } },
	});
	await db.user.deleteMany({
		where: { id: { in: [adminUserId, memberUserId] } },
	});
});

describe("ReportsService", () => {
	it("byClient returns the contact's row with invoiced/costs/profit", async () => {
		const result = await service.byClient(adminUserId);

		const row = result.rows.find((r) => r.contactId === contactId);
		if (!row) throw new Error("expected a row for the fixture contact");

		expect(row.name).toBe(`Pat Client-${suffix}`);
		expect(row.currency).toBe("USD");
		expect(row.dealCount).toBe(1);
		expect(row.invoicedCents).toBe(5000);
		expect(row.costsCents).toBe(2000);
		expect(row.profitCents).toBe(3000);
	});

	it("byClient attributes the same deal figures to every linked contact", async () => {
		const result = await service.byClient(adminUserId);

		const first = result.rows.find((r) => r.contactId === contactId);
		const second = result.rows.find((r) => r.contactId === secondContactId);
		if (!first) throw new Error("expected a row for the first contact");
		if (!second) throw new Error("expected a row for the second contact");

		expect(second.name).toBe(`Sam Cosigner-${suffix}`);
		expect(second.currency).toBe(first.currency);
		expect(second.dealCount).toBe(first.dealCount);
		expect(second.invoicedCents).toBe(first.invoicedCents);
		expect(second.costsCents).toBe(first.costsCents);
		expect(second.profitCents).toBe(first.profitCents);
	});

	it("byClient throws ForbiddenException for an ungranted member", async () => {
		let thrownError: unknown;
		try {
			await service.byClient(memberUserId);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).toBeInstanceOf(ForbiddenException);
	});

	it("byMonth has a row for the current month with the fixture sums", async () => {
		const result = await service.byMonth(adminUserId);

		const row = result.rows.find(
			(r) => r.month === currentMonth && r.currency === "USD",
		);
		if (!row) throw new Error("expected a row for the current month");

		expect(row.invoicedCents).toBeGreaterThanOrEqual(5000);
		expect(row.costsCents).toBeGreaterThanOrEqual(2000);
		expect(row.profitCents).toBeGreaterThanOrEqual(3000);

		expect(result.rows.filter((r) => r.currency === "USD").length).toBe(12);
	});

	it("byMonth throws ForbiddenException for an ungranted member", async () => {
		let thrownError: unknown;
		try {
			await service.byMonth(memberUserId);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).toBeInstanceOf(ForbiddenException);
	});

	it("byCategory with a range covering the cost returns its category total", async () => {
		const result = await service.byCategory(adminUserId, {
			from: today,
			to: today,
		});

		const row = result.rows.find(
			(r) => r.category === "MATERIALS" && r.currency === "USD",
		);
		if (!row) throw new Error("expected a MATERIALS row");
		expect(row.totalCents).toBeGreaterThanOrEqual(2000);
	});

	it("byCategory with a range excluding the cost returns nothing for that category", async () => {
		const past = toDay(new Date("2020-01-01T00:00:00.000Z"));
		const result = await service.byCategory(adminUserId, {
			from: past,
			to: past,
		});

		const row = result.rows.find(
			(r) => r.category === "MATERIALS" && r.currency === "USD",
		);
		expect(row).toBeUndefined();
	});

	it("byCategory throws ForbiddenException for an ungranted member", async () => {
		let thrownError: unknown;
		try {
			await service.byCategory(memberUserId, {});
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).toBeInstanceOf(ForbiddenException);
	});
});
