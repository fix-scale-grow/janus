import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { ContactsService } from "../src/contacts/contacts.service";
import {
	contractCreateFromEstimateInput,
	contractListInput,
} from "../src/contracts/contracts.contracts";
import { ContractsService } from "../src/contracts/contracts.service";
import { estimateListInput } from "../src/estimates/estimates.contracts";
import { EstimatesService } from "../src/estimates/estimates.service";
import { FieldsService } from "../src/fields/fields.service";
import {
	invoiceCreateFromEstimateInput,
	invoiceListInput,
} from "../src/invoices/invoices.contracts";
import { InvoicesService } from "../src/invoices/invoices.service";
import type { MailerService } from "../src/mailer/mailer.service";
import { PhotosService } from "../src/photos/photos.service";
import { ProductionAdvanceService } from "../src/production/production-advance.service";
import { ProposalsService } from "../src/proposals/proposals.service";
import { MergeContextService } from "../src/templates/merge-context.service";
import { TemplatesService } from "../src/templates/templates.service";

const suffix = process.env.TEST_RUN_ID ?? "scope-children";

const noMailer = {
	isConfigured: () => false,
	send: async () => ({ delivered: false }),
} as unknown as MailerService;

const noAgent = {} as unknown as AgentTriggerService;
const noContacts = {} as unknown as ContactsService;
const noProduction = new ProductionAdvanceService(db);
const photos = new PhotosService(db);
const fields = new FieldsService(db, {
	fieldBackfill: async () => undefined,
} as never);
const mergeContext = new MergeContextService(db);
const templates = new TemplatesService(db, mergeContext, noMailer, fields);

const estimates = new EstimatesService(
	db,
	noContacts,
	noMailer,
	templates,
	mergeContext,
	noAgent,
	photos,
);
const invoices = new InvoicesService(
	db,
	noMailer,
	templates,
	mergeContext,
	photos,
	noProduction,
);
const contracts = new ContractsService(db, templates, mergeContext, noMailer);
const proposals = new ProposalsService(
	db,
	templates,
	mergeContext,
	noMailer,
	contracts,
	photos,
);

const DEFAULT_ESTIMATE_LIST_INPUT = estimateListInput.parse({});
const DEFAULT_INVOICE_LIST_INPUT = invoiceListInput.parse({});
const DEFAULT_CONTRACT_LIST_INPUT = contractListInput.parse({});

let f: AccessFixture;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
});

afterAll(async () => {
	await f.cleanup();
});

async function expectNotFound(run: () => Promise<unknown>) {
	try {
		await run();
		throw new Error("expected NotFoundException");
	} catch (error) {
		expect(error).toBeInstanceOf(NotFoundException);
	}
}

async function expectForbidden(run: () => Promise<unknown>) {
	try {
		await run();
		throw new Error("expected ForbiddenException");
	} catch (error) {
		expect(error).toBeInstanceOf(ForbiddenException);
	}
}

describe("children scope", () => {
	describe("estimates", () => {
		test("clerk lists only their estimate", async () => {
			const ids = (
				await estimates.list(DEFAULT_ESTIMATE_LIST_INPUT, f.clerk)
			).rows.map((r) => r.id);
			expect(ids).toContain(f.clerkEstimateId);
			expect(ids).not.toContain(f.otherEstimateId);
		});

		test("OWN sees own deal-less estimate, not another's", async () => {
			const ids = (
				await estimates.list(DEFAULT_ESTIMATE_LIST_INPUT, f.clerk)
			).rows.map((r) => r.id);
			expect(ids).toContain(f.looseEstimateByClerkId);
			expect(ids).not.toContain(f.looseEstimateByAdminId);
		});

		test("crew (ASSIGNED) sees no deal-less estimate", async () => {
			const ids = (
				await estimates.list(DEFAULT_ESTIMATE_LIST_INPUT, f.crew)
			).rows.map((r) => r.id);
			expect(ids).not.toContain(f.looseEstimateByClerkId);
			expect(ids).not.toContain(f.looseEstimateByAdminId);
		});

		test("clerk byId on another deal's estimate is not found", async () => {
			await expectNotFound(() => estimates.byId(f.otherEstimateId, f.clerk));
		});

		test("clerk cannot generate an estimate PDF on another deal", async () => {
			await expectNotFound(() =>
				estimates.document(f.otherEstimateId, f.clerk),
			);
		});

		test("clerk cannot rename another deal's estimate", async () => {
			await expectNotFound(() =>
				estimates.rename({ id: f.otherEstimateId, title: "Hijacked" }, f.clerk),
			);
		});

		test("creating an estimate on another deal is refused", async () => {
			await expectNotFound(() =>
				estimates.create({ dealId: f.otherDealId }, f.clerk),
			);
		});

		test("assigning an out-of-scope contact to an estimate is refused", async () => {
			await expectNotFound(() =>
				estimates.assignContact(
					{ id: f.clerkEstimateId, contactId: f.otherContactId },
					f.clerk,
				),
			);
		});

		test("clerk cannot generate an estimate from another deal's drawing", async () => {
			await expectNotFound(() =>
				estimates.generateFromDrawing({ drawingId: f.otherDrawingId }, f.clerk),
			);
		});

		test("ASSIGNED scope cannot create a deal-less estimate", async () => {
			await expectForbidden(() => estimates.create({}, f.crew));
		});

		test("clerk cannot update a line item on another deal's estimate", async () => {
			const lineItem = await db.estimateLineItem.create({
				data: {
					estimateId: f.otherEstimateId,
					name: "Tear-off",
					unit: "PER_SQUARE",
					quantity: 1,
					priceGoodCents: 0,
					priceBetterCents: 0,
					priceBestCents: 0,
					sortOrder: 0,
				},
				select: { id: true },
			});

			await expectNotFound(() =>
				estimates.updateLineItem(
					{ id: lineItem.id, data: { quantity: 2 } },
					f.clerk,
				),
			);

			await db.estimateLineItem.delete({ where: { id: lineItem.id } });
		});
	});

	describe("invoices", () => {
		test("clerk lists only their invoice", async () => {
			const ids = (
				await invoices.list(DEFAULT_INVOICE_LIST_INPUT, f.clerk)
			).rows.map((r) => r.id);
			expect(ids).toContain(f.clerkInvoiceId);
			expect(ids).not.toContain(f.otherInvoiceId);
		});

		test("clerk byId on another deal's invoice is not found", async () => {
			await expectNotFound(() => invoices.byId(f.otherInvoiceId, f.clerk));
		});

		test("clerk cannot generate an invoice PDF on another deal", async () => {
			await expectNotFound(() => invoices.document(f.otherInvoiceId, f.clerk));
		});

		test("clerk cannot send an invoice on another deal", async () => {
			await expectNotFound(() =>
				invoices.send({ id: f.otherInvoiceId }, undefined, f.clerk),
			);
		});

		test("creating an invoice on another deal is refused", async () => {
			await expectNotFound(() =>
				invoices.create({ dealId: f.otherDealId }, f.clerk),
			);
		});

		test("converting an out-of-scope estimate to an invoice is refused", async () => {
			await expectNotFound(() =>
				invoices.createFromEstimate(
					invoiceCreateFromEstimateInput.parse({
						estimateId: f.otherEstimateId,
					}),
					f.clerk,
				),
			);
		});

		test("clerk cannot mark another deal's invoice paid", async () => {
			await expectNotFound(() =>
				invoices.markPaid(f.otherInvoiceId, f.clerkId, f.clerk),
			);
		});
	});

	describe("contracts", () => {
		test("clerk lists only their contract", async () => {
			const ids = (
				await contracts.list(DEFAULT_CONTRACT_LIST_INPUT, f.clerk)
			).rows.map((r) => r.id);
			expect(ids).toContain(f.clerkContractId);
			expect(ids).not.toContain(f.otherContractId);
		});

		test("clerk byId on another deal's contract is not found", async () => {
			await expectNotFound(() => contracts.byId(f.otherContractId, f.clerk));
		});

		test("clerk cannot generate a contract PDF on another deal", async () => {
			await expectNotFound(() =>
				contracts.document(f.otherContractId, f.clerk),
			);
		});

		test("clerk cannot send a contract on another deal", async () => {
			await expectNotFound(() =>
				contracts.send({ id: f.otherContractId }, undefined, f.clerk),
			);
		});

		test("creating a draft contract from an out-of-scope estimate is refused", async () => {
			await expectNotFound(() =>
				contracts.createFromEstimate(
					contractCreateFromEstimateInput.parse({
						estimateId: f.otherEstimateId,
					}),
					f.clerkId,
					f.clerk,
				),
			);
		});

		test("clerk cannot link another deal's estimate onto their own contract", async () => {
			await expectNotFound(() =>
				contracts.update(
					{
						id: f.clerkContractId,
						data: { estimateId: f.otherEstimateId },
					},
					f.clerk,
				),
			);
		});

		test("clerk cannot link another deal's invoice onto their own contract", async () => {
			await expectNotFound(() =>
				contracts.update(
					{
						id: f.clerkContractId,
						data: { invoiceId: f.otherInvoiceId },
					},
					f.clerk,
				),
			);
		});
	});

	describe("proposals", () => {
		test("forEstimate refuses an out-of-scope estimate", async () => {
			await expectNotFound(() =>
				proposals.forEstimate(f.otherEstimateId, f.clerk),
			);
		});

		test("createFromEstimate refuses an out-of-scope estimate", async () => {
			await expectNotFound(() =>
				proposals.createFromEstimate(f.otherEstimateId, f.clerkId, f.clerk),
			);
		});

		test("clerk cannot generate a proposal PDF on another deal's estimate", async () => {
			const proposal = await db.proposal.create({
				data: {
					title: "Other proposal",
					estimateId: f.otherEstimateId,
					body: [],
					createdById: f.adminId,
				},
				select: { id: true },
			});

			await expectNotFound(() => proposals.document(proposal.id, f.clerk));

			await db.proposal.delete({ where: { id: proposal.id } });
		});
	});
});
