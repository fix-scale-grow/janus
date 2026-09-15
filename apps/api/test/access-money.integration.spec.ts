import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { ForbiddenException } from "@nestjs/common";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ContactsService } from "../src/contacts/contacts.service";
import { contractListInput } from "../src/contracts/contracts.contracts";
import { ContractsService } from "../src/contracts/contracts.service";
import { CostsService } from "../src/costs/costs.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { dealListInput } from "../src/deals/deals.contracts";
import { DealsService } from "../src/deals/deals.service";
import { EstimatesService } from "../src/estimates/estimates.service";
import { FieldsService } from "../src/fields/fields.service";
import { InvoicesService } from "../src/invoices/invoices.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { PermitTriggerService } from "../src/permits/permit-trigger.service";
import { PhotosService } from "../src/photos/photos.service";
import { ProposalsService } from "../src/proposals/proposals.service";
import { ReportsService } from "../src/reports/reports.service";
import { ServicesCatalogService } from "../src/services-catalog/services-catalog.service";
import { MergeContextService } from "../src/templates/merge-context.service";
import { TemplatesService } from "../src/templates/templates.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "access-money-spec";

const noMailer = {
	isConfigured: () => false,
	send: async () => ({ delivered: false }),
} as unknown as MailerService;

const workingMailer = {
	isConfigured: () => true,
	send: async () => ({ delivered: true }),
} as unknown as MailerService;

const agent = {
	contactCreated: async () => undefined,
	estimateGenerated: async () => undefined,
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;

const stamp = new ActivityStampService(db);
const conversion = new ConversionService(db);
const fields = new FieldsService(db, {
	fieldBackfill: async () => undefined,
} as never);
const permitTrigger = {
	onStageChanged: async () => undefined,
} as unknown as PermitTriggerService;

const deals = new DealsService(
	db,
	agent,
	stamp,
	conversion,
	fields,
	permitTrigger,
);
const queue = new AgentQueueService(db);
const contacts = new ContactsService(db, agent, queue, stamp, fields);

const photos = new PhotosService(db);
const mergeContext = new MergeContextService(db);
const templates = new TemplatesService(db, mergeContext, noMailer, fields);

const estimates = new EstimatesService(
	db,
	{} as never,
	noMailer,
	templates,
	mergeContext,
	agent,
	photos,
);
const invoices = new InvoicesService(
	db,
	noMailer,
	templates,
	mergeContext,
	photos,
	{ advanceWhenPaid: async () => undefined } as never,
);
const contracts = new ContractsService(
	db,
	templates,
	mergeContext,
	workingMailer,
);
const proposals = new ProposalsService(
	db,
	templates,
	mergeContext,
	workingMailer,
	contracts,
	photos,
);
const servicesCatalog = new ServicesCatalogService(db);
const dashboard = new DashboardService(db, conversion);
const reports = new ReportsService(db, conversion);
const costs = new CostsService(db);

const DEFAULT_DEAL_LIST_INPUT = dealListInput.parse({});
const DEFAULT_CONTRACT_LIST_INPUT = contractListInput.parse({});

let f: AccessFixture;
let anyServiceId: string;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
	await db.deal.update({
		where: { id: f.clerkDealId },
		data: { amount: 500, currency: "USD" },
	});
	const service = await db.service.create({
		data: {
			name: `Access money service ${suffix}`,
			unit: "PER_SQUARE",
			unitPriceCents: 1000,
		},
		select: { id: true },
	});
	anyServiceId = service.id;
});

afterAll(async () => {
	await db.service.delete({ where: { id: anyServiceId } });
	await f.cleanup();
});

async function expectForbidden(run: () => Promise<unknown>) {
	let thrown: unknown;
	try {
		await run();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(ForbiddenException);
}

describe("money masking", () => {
	it("crew lead gets null prices on estimates", async () => {
		const office = await estimates.byId(f.clerkEstimateId, f.office);
		expect(office.lineItems[0]?.priceBetterCents).not.toBeNull();

		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const masked = await estimates.byId(f.clerkEstimateId, noPrices);
		expect(masked.lineItems.length).toBeGreaterThan(0);
		expect(masked.lineItems.every((li) => li.priceBetterCents === null)).toBe(
			true,
		);
		expect(masked.totals.betterCents).toBeNull();
	});

	it("clerk deal list hides nothing when prices are on", async () => {
		const rows = (await deals.list(DEFAULT_DEAL_LIST_INPUT, f.clerk)).rows;
		expect(rows.find((r) => r.id === f.clerkDealId)?.amountCents).not.toBe(
			undefined,
		);
	});

	it("a scope-ALL principal with no money switches gets null amounts everywhere on deals", async () => {
		const officeNoPrices = {
			...f.office,
			policy: { ...f.office.policy, money: [] },
		};

		const list = await deals.list(DEFAULT_DEAL_LIST_INPUT, officeNoPrices);
		expect(list.rows.length).toBeGreaterThan(0);
		for (const row of list.rows) {
			expect(row.amountCents).toBeNull();
			expect(row.baseAmountCents).toBeNull();
		}
		expect(list.openValueCents).toBeNull();

		const detail = await deals.byId(f.clerkDealId, officeNoPrices);
		expect(detail.amountCents).toBeNull();
		expect(detail.baseAmountCents).toBeNull();
		expect(detail.fxRate).toBeNull();

		const withPrices = await deals.byId(f.clerkDealId, f.office);
		expect(withPrices.amountCents).not.toBeNull();
	});

	it("invoices byId masks totalCents and each line item's priceCents without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const row = await invoices.byId(f.clerkInvoiceId, noPrices);
		expect(row.totalCents).toBeNull();
		expect(row.lineItems.length).toBeGreaterThan(0);
		expect(row.lineItems.every((li) => li.priceCents === null)).toBe(true);

		const unmasked = await invoices.byId(f.clerkInvoiceId, f.clerk);
		expect(unmasked.totalCents).not.toBeNull();
	});

	it("estimates document and send refuse without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		await expectForbidden(() =>
			estimates.document(f.clerkEstimateId, noPrices),
		);
		await expectForbidden(() => invoices.document(f.clerkInvoiceId, noPrices));
	});

	it("contracts list masks valueCents without prices", async () => {
		const contract = await contracts.createFromEstimate(
			{ estimateId: f.clerkEstimateId },
			f.clerkId,
			f.admin,
		);
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const rows = (await contracts.list(DEFAULT_CONTRACT_LIST_INPUT, noPrices))
			.rows;
		const row = rows.find((r) => r.id === contract.id);
		expect(row?.valueCents).toBeNull();

		const unmaskedRows = (
			await contracts.list(DEFAULT_CONTRACT_LIST_INPUT, f.clerk)
		).rows;
		expect(
			unmaskedRows.find((r) => r.id === contract.id)?.valueCents,
		).not.toBeNull();

		await db.contract.delete({ where: { id: contract.id } });
	});

	it("services-catalog reads mask prices and writes need priceBook", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const row = await servicesCatalog.byId(anyServiceId, noPrices);
		expect(row.unitPriceCents).toBeNull();

		const unmasked = await servicesCatalog.byId(anyServiceId, f.office);
		expect(unmasked.unitPriceCents).not.toBeNull();
	});

	it("price book edits need money.priceBook", async () => {
		await expectForbidden(() =>
			servicesCatalog.update(
				{ id: anyServiceId, data: { unitPriceCents: 1 } },
				f.office,
			),
		);

		const updated = await servicesCatalog.update(
			{ id: anyServiceId, data: { unitPriceCents: 1234 } },
			f.admin,
		);
		expect(updated.unitPriceCents).toBe(1234);
	});

	it("reports use money.profit, not profit.view", async () => {
		const range = {};
		await expectForbidden(() => reports.jobProfitability(f.clerk, range));
		await expectForbidden(() => reports.costBreakdown(f.clerk, range));
		await expectForbidden(() => reports.arAging(f.clerk, range));
		await expectForbidden(() => reports.profitOverTime(f.clerk, range));

		const board = await reports.leaderboard(f.clerk, range);
		expect(board.rows.length).toBeGreaterThan(0);
		expect(board.rows.every((r) => r.wonCents === null)).toBe(true);

		const admin = await reports.leaderboard(f.admin, range);
		expect(admin.rows.length).toBe(board.rows.length);
	});

	it("costs.profitForDeal needs money.profit, costs.list masks amountCents", async () => {
		await expectForbidden(() => costs.profitForDeal(f.clerkDealId, f.clerk));
		const profit = await costs.profitForDeal(f.clerkDealId, f.admin);
		expect(profit.byCurrency).toBeDefined();

		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const list = await costs.list({ dealId: f.clerkDealId }, noPrices);
		expect(list.rows.length).toBeGreaterThan(0);
		expect(list.rows.every((row) => row.amountCents === null)).toBe(true);
	});

	it("dashboard summary masks money fields without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const summary = await dashboard.summary(
			f.clerkId,
			{ scope: "everyone" },
			noPrices,
		);
		expect(summary.pipeline.totalCents).toBeNull();
		expect(summary.wonThisMonth.valueCents).toBeNull();
		expect(summary.performance.avgDealCents).toBeNull();
		expect(summary.closingThisMonthTotal.valueCents).toBeNull();
		expect(summary.biggestOpen.length).toBeGreaterThan(0);
		for (const deal of summary.biggestOpen) {
			expect(deal.amountCents).toBeNull();
		}

		const unmasked = await dashboard.summary(
			f.clerkId,
			{ scope: "everyone" },
			f.clerk,
		);
		expect(unmasked.pipeline.totalCents).not.toBeNull();
	});

	it("contact detail masks linked deals' amountCents without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const contact = await contacts.byId(f.clerkContactId, noPrices);
		expect(contact.deals.length).toBeGreaterThan(0);
		expect(contact.deals.every((deal) => deal.amountCents === null)).toBe(true);

		const unmasked = await contacts.byId(f.clerkContactId, f.clerk);
		expect(
			unmasked.deals.find((deal) => deal.id === f.clerkDealId)?.amountCents,
		).not.toBeNull();
	});

	it("estimates addLineItem by serviceId masks the returned prices without prices", async () => {
		const created = await estimates.addLineItem(
			{ estimateId: f.clerkEstimateId, serviceId: anyServiceId, quantity: 1 },
			f.admin,
		);
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const maskedCreated = await estimates.addLineItem(
			{ estimateId: f.clerkEstimateId, serviceId: anyServiceId, quantity: 1 },
			noPrices,
		);
		expect(maskedCreated.priceBetterCents).toBeNull();

		await db.estimateLineItem.deleteMany({
			where: { id: { in: [created.id, maskedCreated.id] } },
		});
	});

	it("estimates updateLineItem masks the returned row and refuses a price write without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const item = await db.estimateLineItem.findFirstOrThrow({
			where: { estimateId: f.clerkEstimateId },
			select: { id: true },
		});

		await expectForbidden(() =>
			estimates.updateLineItem(
				{ id: item.id, data: { priceBetterCents: 9999 } },
				noPrices,
			),
		);

		const renamed = await estimates.updateLineItem(
			{ id: item.id, data: { name: "Renamed (no prices)" } },
			noPrices,
		);
		expect(renamed.priceBetterCents).toBeNull();

		const unmasked = await estimates.updateLineItem(
			{ id: item.id, data: { priceBetterCents: 6500 } },
			f.admin,
		);
		expect(unmasked.priceBetterCents).toBe(6500);
	});

	it("invoices updateLineItem masks the returned row and refuses a price write without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const item = await db.invoiceLineItem.findFirstOrThrow({
			where: { invoiceId: f.clerkInvoiceId },
			select: { id: true },
		});

		await expectForbidden(() =>
			invoices.updateLineItem(
				{ id: item.id, data: { priceCents: 9999 } },
				noPrices,
			),
		);

		const renamed = await invoices.updateLineItem(
			{ id: item.id, data: { name: "Renamed (no prices)" } },
			noPrices,
		);
		expect(renamed.priceCents).toBeNull();

		const unmasked = await invoices.updateLineItem(
			{ id: item.id, data: { priceCents: 6500 } },
			f.admin,
		);
		expect(unmasked.priceCents).toBe(6500);
	});

	it("invoices addLineItem refuses a nonzero price write without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		await expectForbidden(() =>
			invoices.addLineItem(
				{
					invoiceId: f.clerkInvoiceId,
					name: "Blocked",
					unit: "PER_EACH",
					quantity: 1,
					priceCents: 500,
				},
				noPrices,
			),
		);

		const created = await invoices.addLineItem(
			{
				invoiceId: f.clerkInvoiceId,
				name: "Allowed at zero",
				unit: "PER_EACH",
				quantity: 1,
				priceCents: 0,
			},
			noPrices,
		);
		expect(created.priceCents).toBeNull();

		const stored = await db.invoiceLineItem.findUniqueOrThrow({
			where: { id: created.id },
			select: { priceCents: true },
		});
		expect(stored.priceCents).toBe(0);

		await db.invoiceLineItem.delete({ where: { id: created.id } });
	});

	it("contracts send and document refuse a priced render without prices", async () => {
		const contract = await contracts.createFromEstimate(
			{ estimateId: f.clerkEstimateId },
			f.clerkId,
			f.admin,
		);
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };

		await expectForbidden(() => contracts.document(contract.id, noPrices));
		await expectForbidden(() =>
			contracts.send(
				{ id: contract.id, to: "client@example.test" },
				undefined,
				noPrices,
			),
		);

		await db.contract.delete({ where: { id: contract.id } });
	});

	it("proposals null the viewToken for a principal without prices", async () => {
		await db.estimate.update({
			where: { id: f.clerkEstimateId },
			data: { contactId: f.clerkContactId },
		});
		const created = await proposals.createFromEstimate(
			f.clerkEstimateId,
			f.clerkId,
			f.admin,
		);
		const sent = await proposals.send(
			{ id: created.id, to: "client@example.test" },
			"Kyle",
			f.admin,
		);
		expect(sent.viewToken).not.toBeNull();

		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const masked = await proposals.forEstimate(f.clerkEstimateId, noPrices);
		expect(masked?.viewToken).toBeNull();

		const unmasked = await proposals.forEstimate(f.clerkEstimateId, f.admin);
		expect(unmasked?.viewToken).not.toBeNull();

		await db.proposal.delete({ where: { id: created.id } });
	});

	it("dashboard recentActivity is scoped to the principal's deals and contacts when viewing everyone", async () => {
		const clerkActivity = await db.activity.create({
			data: {
				type: "NOTE",
				subject: `Clerk-scoped note ${suffix}`,
				occurredAt: new Date(),
				dealId: f.clerkDealId,
				createdById: f.clerkId,
			},
			select: { id: true },
		});
		const otherActivity = await db.activity.create({
			data: {
				type: "NOTE",
				subject: `Other-scoped note ${suffix}`,
				occurredAt: new Date(),
				dealId: f.otherDealId,
				createdById: f.adminId,
			},
			select: { id: true },
		});

		const scoped = await dashboard.summary(
			f.clerkId,
			{ scope: "everyone" },
			f.clerk,
		);
		const subjects = scoped.recentActivity.map((entry) => entry.subject);
		expect(subjects).toContain(`Clerk-scoped note ${suffix}`);
		expect(subjects).not.toContain(`Other-scoped note ${suffix}`);

		const asAdmin = await dashboard.summary(
			f.adminId,
			{ scope: "everyone" },
			f.admin,
		);
		const adminSubjects = asAdmin.recentActivity.map((entry) => entry.subject);
		expect(adminSubjects).toContain(`Other-scoped note ${suffix}`);

		await db.activity.deleteMany({
			where: { id: { in: [clerkActivity.id, otherActivity.id] } },
		});
	});
});
