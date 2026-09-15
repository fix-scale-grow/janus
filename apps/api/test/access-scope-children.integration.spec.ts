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
import { CostsService } from "../src/costs/costs.service";
import { drawingListInput } from "../src/drawings/drawings.contracts";
import { DrawingsService } from "../src/drawings/drawings.service";
import { estimateListInput } from "../src/estimates/estimates.contracts";
import { EstimatesService } from "../src/estimates/estimates.service";
import { FieldsService } from "../src/fields/fields.service";
import {
	invoiceCreateFromEstimateInput,
	invoiceListInput,
} from "../src/invoices/invoices.contracts";
import { InvoicesService } from "../src/invoices/invoices.service";
import type { MailerService } from "../src/mailer/mailer.service";
import { PermitPrefillService } from "../src/permits/permit-prefill.service";
import { permitListInput } from "../src/permits/permits.contracts";
import { PermitsService } from "../src/permits/permits.service";
import { PlaybooksService } from "../src/permits/playbooks.service";
import { PhotosService } from "../src/photos/photos.service";
import { ProductionAdvanceService } from "../src/production/production-advance.service";
import { projectListInput } from "../src/projects/projects.contracts";
import { ProjectsService } from "../src/projects/projects.service";
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
const drawings = new DrawingsService(db);
const projects = new ProjectsService(db, noProduction);
const playbooks = new PlaybooksService(db);
const permitPrefill = new PermitPrefillService(db);
const permits = new PermitsService(db, playbooks, permitPrefill);
const costs = new CostsService(db);

const DEFAULT_ESTIMATE_LIST_INPUT = estimateListInput.parse({});
const DEFAULT_INVOICE_LIST_INPUT = invoiceListInput.parse({});
const DEFAULT_CONTRACT_LIST_INPUT = contractListInput.parse({});
const DEFAULT_DRAWING_LIST_INPUT = drawingListInput.parse({});
const DEFAULT_PROJECT_LIST_INPUT = projectListInput.parse({});

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

async function expectForbiddenOrNotFound(run: () => Promise<unknown>) {
	try {
		await run();
		throw new Error("expected ForbiddenException or NotFoundException");
	} catch (error) {
		expect(
			error instanceof ForbiddenException || error instanceof NotFoundException,
		).toBe(true);
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

	describe("drawings", () => {
		test("OWN sees own deal-less drawing, not another's", async () => {
			const ids = (
				await drawings.list(DEFAULT_DRAWING_LIST_INPUT, f.clerk)
			).rows.map((r) => r.id);
			expect(ids).toContain(f.looseDrawingByClerkId);
			expect(ids).not.toContain(f.looseDrawingByAdminId);
		});

		test("crew (ASSIGNED) sees neither deal-less drawing", async () => {
			const ids = (
				await drawings.list(DEFAULT_DRAWING_LIST_INPUT, f.crew)
			).rows.map((r) => r.id);
			expect(ids).not.toContain(f.looseDrawingByClerkId);
			expect(ids).not.toContain(f.looseDrawingByAdminId);
		});

		test("clerk byId on another deal's drawing is not found", async () => {
			await expectNotFound(() => drawings.byId(f.otherDrawingId, f.clerk));
		});

		test("clerk cannot attach their drawing to another deal", async () => {
			await expectNotFound(() =>
				drawings.attach(
					{ id: f.clerkDrawingId, dealId: f.otherDealId },
					f.clerk,
				),
			);
		});
	});

	describe("projects", () => {
		test("clerk list excludes another deal's project", async () => {
			const ids = (
				await projects.list(DEFAULT_PROJECT_LIST_INPUT, f.clerk)
			).rows.map((r) => r.id);
			expect(ids).toContain(f.clerkProjectId);
			expect(ids).not.toContain(f.otherProjectId);
		});

		test("clerk calendarRange excludes another deal's project", async () => {
			const from = new Date();
			from.setUTCDate(from.getUTCDate() - 30);
			const to = new Date();
			to.setUTCDate(to.getUTCDate() + 30);

			const ids = (await projects.calendarRange({ from, to }, f.clerk)).map(
				(r) => r.id,
			);
			expect(ids).not.toContain(f.otherProjectId);
		});

		test("clerk task mutation on another deal's project is not found", async () => {
			const task = await db.projectTask.create({
				data: {
					projectId: f.otherProjectId,
					name: "Hijack target",
					sortOrder: 0,
				},
				select: { id: true },
			});

			await expectNotFound(() =>
				projects.taskUpdate(
					{ id: task.id, status: "IN_PROGRESS" },
					f.clerkId,
					f.clerk,
				),
			);

			await db.projectTask.delete({ where: { id: task.id } });
		});
	});

	describe("photos", () => {
		test("clerk list on another deal returns nothing", async () => {
			const { rows } = await photos.list({ dealId: f.otherDealId }, f.clerk);
			expect(rows).toEqual([]);
		});

		test("clerk does not see a contact-only photo on another contact", async () => {
			const { rows } = await photos.list({}, f.clerk);
			expect(rows.map((r) => r.id)).not.toContain(
				f.contactOnlyPhotoOnOtherContactId,
			);
		});

		test("crew lead sees no photos before assignments exist", async () => {
			const { rows } = await photos.list({ dealId: f.clerkDealId }, f.crew);
			expect(rows).toEqual([]);
		});

		test("clerk cannot link their photo to another deal's project", async () => {
			await expectNotFound(() =>
				photos.linkProject(
					{ projectId: f.otherProjectId, photoId: f.clerkPhotoId },
					f.clerk,
				),
			);
		});
	});

	describe("permits", () => {
		test("clerk list excludes another deal's permit", async () => {
			const { rows } = await permits.list(permitListInput.parse({}), f.clerk);
			const ids = rows.map((r) => r.id);
			expect(ids).toContain(f.clerkPermitId);
			expect(ids).not.toContain(f.otherPermitId);
		});

		test("clerk worksheetPdf on another deal's permit is not found", async () => {
			await expectNotFound(() =>
				permits.worksheetPdf({ permitId: f.otherPermitId }, f.clerk),
			);
		});
	});

	describe("costs", () => {
		test("clerk list on another deal is not found", async () => {
			await expectNotFound(() =>
				costs.list({ dealId: f.otherDealId }, f.clerk),
			);
		});

		test("crew lead cannot create a cost on another deal", async () => {
			await expectForbiddenOrNotFound(() =>
				costs.create(
					{
						dealId: f.otherDealId,
						date: new Date(),
						amountCents: 500,
						category: "MATERIALS",
					},
					f.clerkId,
					f.crew,
				),
			);
		});
	});
});
