import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { ForbiddenException } from "@nestjs/common";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";
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
const contracts = new ContractsService(db, templates, mergeContext, noMailer);
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

	it("crew lead (no money switches at all) gets null amounts on deals", async () => {
		const rows = (await deals.list(DEFAULT_DEAL_LIST_INPUT, f.crew)).rows;
		for (const row of rows) {
			expect(row.amountCents).toBeNull();
			expect(row.baseAmountCents).toBeNull();
		}
	});

	it("invoices byId masks totalCents and each line item's priceCents without prices", async () => {
		const noPrices = { ...f.clerk, policy: { ...f.clerk.policy, money: [] } };
		const row = await invoices.byId(f.clerkInvoiceId, noPrices);
		expect(row.totalCents).toBeNull();
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
});
