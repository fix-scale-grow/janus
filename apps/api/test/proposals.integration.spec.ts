import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { adminPrincipal } from "@crm/db/access-policy";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ContractsService } from "../src/contracts/contracts.service";
import { FieldsService } from "../src/fields/fields.service";
import type { MailerService } from "../src/mailer/mailer.service";
import { PhotosService } from "../src/photos/photos.service";
import { ProposalsService } from "../src/proposals/proposals.service";
import { MergeContextService } from "../src/templates/merge-context.service";
import { TemplatesService } from "../src/templates/templates.service";

const suffix = process.env.TEST_RUN_ID ?? "proposals-spec";

async function expectRejects(
	run: () => Promise<unknown>,
	kind: new (...args: never[]) => Error,
) {
	try {
		await run();
	} catch (error) {
		expect(error).toBeInstanceOf(kind);
		return;
	}
	throw new Error("Expected the call to reject.");
}

const mailer = {
	isConfigured: () => true,
	send: async () => ({ delivered: true }),
} as unknown as MailerService;

const mergeContext = new MergeContextService(db);
const fields = new FieldsService(db, {
	fieldBackfill: async () => undefined,
} as never);
const templates = new TemplatesService(db, mergeContext, mailer, fields);
const contracts = new ContractsService(db, templates, mergeContext, mailer);
const photos = new PhotosService(db);
const service = new ProposalsService(
	db,
	templates,
	mergeContext,
	mailer,
	contracts,
	photos,
);

let userId: string;
let contactId: string;
let estimateId: string;

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

	const user = await db.user.create({
		data: {
			id: `proposals-user-${suffix}`,
			name: "Proposal User",
			email: `proposals-user-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	const contact = await db.contact.create({
		data: {
			id: `proposals-contact-${suffix}`,
			firstName: "Paula",
			lastName: "Proposal",
			email: `paula-${suffix}@example.test`,
		},
		select: { id: true },
	});
	contactId = contact.id;
});

afterAll(async () => {
	await db.activity.deleteMany({
		where: { subject: "Proposal accepted", createdById: userId },
	});
	await db.contract.deleteMany({ where: { createdById: userId } });
	await db.proposal.deleteMany({ where: { createdById: userId } });
	await db.estimate.deleteMany({
		where: { id: { startsWith: "proposals-estimate-" } },
	});
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.user.deleteMany({ where: { id: userId } });
});

beforeEach(async () => {
	await db.contract.deleteMany({ where: { createdById: userId } });
	await db.proposal.deleteMany({ where: { createdById: userId } });
	await db.estimate.deleteMany({
		where: { id: { startsWith: "proposals-estimate-" } },
	});

	const estimate = await db.estimate.create({
		data: {
			id: `proposals-estimate-${suffix}`,
			title: "Walkthrough roof",
			contactId,
			selectedTier: "BETTER",
			createdById: userId,
			lineItems: {
				create: [
					{
						name: "Tear-off",
						unit: "PER_SQUARE",
						quantity: 10,
						priceGoodCents: 5000,
						priceBetterCents: 6000,
						priceBestCents: 7000,
						sortOrder: 0,
					},
				],
			},
		},
		select: { id: true },
	});
	estimateId = estimate.id;
});

describe("ProposalsService", () => {
	it("creates from the estimate with a seeded body and is idempotent", async () => {
		const first = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		expect(first.title).toBe("Walkthrough roof");
		expect(first.status).toBe("DRAFT");
		expect(first.body.length).toBeGreaterThan(0);

		const second = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		expect(second.id).toBe(first.id);
	});

	it("sends, exposes byToken, and accepts atomically", async () => {
		const created = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		const sent = await service.send(
			{ id: created.id },
			"Kyle",
			adminPrincipal("test"),
		);
		expect(sent.status).toBe("SENT");
		expect(sent.sentTo).toBe(`paula-${suffix}@example.test`);
		const token = sent.viewToken;
		if (!token) throw new Error("no token");

		const view = await service.byToken(token);
		expect(view.status).toBe("SENT");
		expect(view.defaultTier).toBe("BETTER");
		expect(view.totals.BEST).toBe(70000);
		expect(view.expired).toBe(false);

		const accepted = await service.accept({
			token,
			tier: "BEST",
			name: "Paula Proposal",
		});
		expect(accepted.status).toBe("ACCEPTED");

		const estimate = await db.estimate.findUniqueOrThrow({
			where: { id: estimateId },
			select: { status: true, selectedTier: true },
		});
		expect(estimate.status).toBe("ACCEPTED");
		expect(estimate.selectedTier).toBe("BEST");

		const contract = await db.contract.findFirst({
			where: { estimateId, createdById: userId },
			select: { status: true },
		});
		expect(contract?.status).toBe("DRAFT");

		await expectRejects(
			() => service.accept({ token, tier: "GOOD", name: "Again" }),
			ConflictException,
		);
	});

	it("refuses to send a proposal whose body has an empty merge field", async () => {
		const created = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		await db.proposal.update({
			where: { id: created.id },
			data: {
				body: [
					{
						kind: "text",
						html: "For the property at {{deal.address}}, covering the work.",
					},
				],
			},
		});

		let message = "";
		try {
			await service.send({ id: created.id }, "Kyle", adminPrincipal("test"));
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message).toContain("Job address");

		const untouched = await db.proposal.findUnique({
			where: { id: created.id },
			select: { status: true, viewToken: true },
		});
		expect(untouched?.status).toBe("DRAFT");
		expect(untouched?.viewToken).toBeNull();
	});

	it("hides drafts from the public view", async () => {
		await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		await expectRejects(
			() => service.byToken("not-a-real-token"),
			NotFoundException,
		);
	});

	it("refuses an expired accept", async () => {
		const created = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		const sent = await service.send(
			{ id: created.id },
			"Kyle",
			adminPrincipal("test"),
		);
		const token = sent.viewToken;
		if (!token) throw new Error("no token");
		await db.proposal.update({
			where: { id: created.id },
			data: { tokenExpiresAt: new Date(Date.now() - 1000) },
		});
		await expectRejects(
			() => service.accept({ token, tier: "GOOD", name: "Late" }),
			ConflictException,
		);
	});

	it("stamps views through recordView but never on byToken", async () => {
		const created = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		const sent = await service.send(
			{ id: created.id },
			"Kyle",
			adminPrincipal("test"),
		);
		const token = sent.viewToken;
		if (!token) throw new Error("no token");

		await service.byToken(token);
		const untouched = await db.proposal.findUniqueOrThrow({
			where: { id: created.id },
			select: { viewCount: true },
		});
		expect(untouched.viewCount).toBe(0);

		await service.recordView(token);
		await service.recordView(token);

		const row = await db.proposal.findUniqueOrThrow({
			where: { id: created.id },
			select: { viewCount: true, firstViewedAt: true, lastViewedAt: true },
		});
		expect(row.viewCount).toBe(2);
		expect(row.firstViewedAt).not.toBeNull();
		expect(row.lastViewedAt).not.toBeNull();
	});

	it("declines atomically and marks the estimate", async () => {
		const created = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		const sent = await service.send(
			{ id: created.id },
			"Kyle",
			adminPrincipal("test"),
		);
		const token = sent.viewToken;
		if (!token) throw new Error("no token");

		const declined = await service.decline({
			token,
			name: "Paula Proposal",
			note: "Going another way this season.",
		});
		expect(declined.status).toBe("DECLINED");

		const estimate = await db.estimate.findUniqueOrThrow({
			where: { id: estimateId },
			select: { status: true },
		});
		expect(estimate.status).toBe("DECLINED");

		await expectRejects(
			() => service.decline({ token, name: "Again" }),
			ConflictException,
		);
		await expectRejects(
			() => service.accept({ token, tier: "GOOD", name: "Too late" }),
			ConflictException,
		);
	});

	it("revises into a new draft and kills the old link", async () => {
		const created = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		await service.update(
			{
				id: created.id,
				data: { coverTitle: "Original cover" },
			},
			adminPrincipal("test"),
		);
		const sent = await service.send(
			{ id: created.id },
			"Kyle",
			adminPrincipal("test"),
		);
		const token = sent.viewToken;
		if (!token) throw new Error("no token");

		const revised = await service.revise(
			created.id,
			userId,
			adminPrincipal("test"),
		);
		expect(revised.status).toBe("DRAFT");
		expect(revised.revision).toBe(2);
		expect(revised.coverTitle).toBe("Original cover");

		const latest = await service.forEstimate(
			estimateId,
			adminPrincipal("test"),
		);
		expect(latest?.id).toBe(revised.id);

		const old = await db.proposal.findUniqueOrThrow({
			where: { id: created.id },
			select: { status: true, viewToken: true },
		});
		expect(old.status).toBe("VOID");
		expect(old.viewToken).toBeNull();

		await expectRejects(() => service.byToken(token), NotFoundException);
		await expectRejects(
			() => service.revise(revised.id, userId, adminPrincipal("test")),
			ConflictException,
		);
	});

	it("locks the body after sending and voids cleanly", async () => {
		const created = await service.createFromEstimate(
			estimateId,
			userId,
			adminPrincipal("test"),
		);
		await service.send({ id: created.id }, "Kyle", adminPrincipal("test"));
		await expectRejects(
			() =>
				service.update(
					{
						id: created.id,
						data: { body: [{ kind: "heading", text: "Nope" }] },
					},
					adminPrincipal("test"),
				),
			ConflictException,
		);

		const voided = await service.void(created.id, adminPrincipal("test"));
		expect(voided.status).toBe("VOID");
		expect(voided.viewToken).toBeNull();
	});
});
