import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { RecentsService } from "../src/recents/recents.service";

const suffix = process.env.TEST_RUN_ID ?? "recents-spec";
const prefix = `recents_${suffix}`;

const recents = new RecentsService(db);

let ownerId: string;
let otherUserId: string;
let stageId: string;
let dealId: string;
let dealNumber: number;
let contactId: string;
let drawingId: string;
let estimateId: string;
let invoiceId: string;
let invoiceNumber: number;
let contractId: string;
let contractNumber: number;
let projectId: string;
let pruneDealIds: string[] = [];

async function clean() {
	await db.recentRecord.deleteMany({
		where: { user: { email: { endsWith: `${prefix}.test` } } },
	});
	await db.contract.deleteMany({ where: { title: { startsWith: prefix } } });
	await db.invoice.deleteMany({
		where: { createdBy: { email: { endsWith: `${prefix}.test` } } },
	});
	await db.project.deleteMany({ where: { name: { startsWith: prefix } } });
	await db.estimate.deleteMany({ where: { title: { startsWith: prefix } } });
	await db.drawing.deleteMany({ where: { title: { startsWith: prefix } } });
	await db.deal.deleteMany({ where: { name: { startsWith: prefix } } });
	await db.contact.deleteMany({ where: { firstName: prefix } });
	await db.user.deleteMany({
		where: { email: { endsWith: `${prefix}.test` } },
	});
}

beforeAll(async () => {
	await clean();

	const owner = await db.user.create({
		data: {
			id: `${prefix}-owner`,
			name: "Recents Owner",
			email: `owner@${prefix}.test`,
		},
		select: { id: true },
	});
	ownerId = owner.id;

	const other = await db.user.create({
		data: {
			id: `${prefix}-other`,
			name: "Recents Other",
			email: `other@${prefix}.test`,
		},
		select: { id: true },
	});
	otherUserId = other.id;

	const stage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	stageId = stage.id;

	const deal = await db.deal.create({
		data: {
			name: `${prefix} Deal`,
			ownerId,
			stageId,
			currency: "USD",
		},
		select: { id: true, number: true },
	});
	dealId = deal.id;
	dealNumber = deal.number;

	const contact = await db.contact.create({
		data: { firstName: prefix, lastName: "Fenwick" },
		select: { id: true },
	});
	contactId = contact.id;

	const drawing = await db.drawing.create({
		data: {
			title: `${prefix} Drawing`,
			scene: {},
			createdById: ownerId,
		},
		select: { id: true },
	});
	drawingId = drawing.id;

	const estimate = await db.estimate.create({
		data: {
			title: `${prefix} Estimate`,
			dealId,
			createdById: ownerId,
		},
		select: { id: true },
	});
	estimateId = estimate.id;

	const invoice = await db.invoice.create({
		data: { currency: "USD", dealId, createdById: ownerId },
		select: { id: true, number: true },
	});
	invoiceId = invoice.id;
	invoiceNumber = invoice.number;

	const contract = await db.contract.create({
		data: {
			title: `${prefix} Contract`,
			body: [],
			dealId,
			createdById: ownerId,
		},
		select: { id: true, number: true },
	});
	contractId = contract.id;
	contractNumber = contract.number;

	const project = await db.project.create({
		data: {
			name: `${prefix} Project`,
			startDate: new Date(),
			dealId,
			createdById: ownerId,
			status: "ACTIVE",
		},
		select: { id: true },
	});
	projectId = project.id;
});

afterAll(async () => {
	await db.recentRecord.deleteMany({
		where: { userId: { in: [ownerId, otherUserId] } },
	});
	await db.contract.deleteMany({ where: { id: contractId } });
	await db.invoice.deleteMany({ where: { id: invoiceId } });
	await db.project.deleteMany({ where: { id: projectId } });
	await db.estimate.deleteMany({ where: { id: estimateId } });
	await db.drawing.deleteMany({ where: { id: drawingId } });
	await db.deal.deleteMany({
		where: { id: { in: [dealId, ...pruneDealIds] } },
	});
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.user.deleteMany({ where: { id: { in: [ownerId, otherUserId] } } });
});

describe("RecentsService", () => {
	it("creates a recent on the first touch, then bumps rather than duplicates", async () => {
		await recents.touch({ kind: "deal", recordId: dealId }, ownerId);
		const firstTouch = await db.recentRecord.findUniqueOrThrow({
			where: {
				userId_kind_recordId: {
					userId: ownerId,
					kind: "deal",
					recordId: dealId,
				},
			},
			select: { touchedAt: true },
		});

		await new Promise((resolve) => setTimeout(resolve, 5));
		await recents.touch({ kind: "deal", recordId: dealId }, ownerId);

		const rows = await db.recentRecord.findMany({
			where: { userId: ownerId, kind: "deal", recordId: dealId },
		});
		expect(rows.length).toBe(1);
		expect(rows[0]?.touchedAt.getTime()).toBeGreaterThan(
			firstTouch.touchedAt.getTime(),
		);
	});

	it("prunes beyond the cap, keeping only the 15 newest", async () => {
		await db.recentRecord.deleteMany({ where: { userId: ownerId } });

		const deals = await Promise.all(
			Array.from({ length: 17 }, (_, index) =>
				db.deal.create({
					data: {
						name: `${prefix} Prune Deal ${index}`,
						ownerId,
						stageId,
						currency: "USD",
					},
					select: { id: true },
				}),
			),
		);
		pruneDealIds = deals.map((deal) => deal.id);

		for (const deal of deals) {
			await recents.touch({ kind: "deal", recordId: deal.id }, ownerId);
			await new Promise((resolve) => setTimeout(resolve, 3));
		}

		const remaining = await db.recentRecord.findMany({
			where: { userId: ownerId },
			orderBy: { touchedAt: "desc" },
		});
		expect(remaining.length).toBe(15);

		const keptIds = new Set(remaining.map((row) => row.recordId));
		const newestIds = deals.slice(2).map((deal) => deal.id);
		for (const id of newestIds) expect(keptIds.has(id)).toBe(true);
		for (const id of deals.slice(0, 2).map((deal) => deal.id)) {
			expect(keptIds.has(id)).toBe(false);
		}

		await db.recentRecord.deleteMany({ where: { userId: ownerId } });
	});

	it("joins labels correctly per kind", async () => {
		await recents.touch({ kind: "contact", recordId: contactId }, ownerId);
		await recents.touch({ kind: "deal", recordId: dealId }, ownerId);
		await recents.touch({ kind: "drawing", recordId: drawingId }, ownerId);
		await recents.touch({ kind: "estimate", recordId: estimateId }, ownerId);
		await recents.touch({ kind: "invoice", recordId: invoiceId }, ownerId);
		await recents.touch({ kind: "contract", recordId: contractId }, ownerId);
		await recents.touch({ kind: "project", recordId: projectId }, ownerId);

		const { rows } = await recents.list(ownerId);
		const byKind = Object.fromEntries(rows.map((row) => [row.kind, row]));

		expect(byKind.contact?.label).toBe(`${prefix} Fenwick`);
		expect(byKind.deal?.label).toBe(`#${dealNumber} · ${prefix} Deal`);
		expect(byKind.drawing?.label).toBe(`${prefix} Drawing`);
		expect(byKind.estimate?.label).toBe(`${prefix} Estimate`);
		expect(byKind.invoice?.label).toBe(`Invoice #${invoiceNumber}`);
		expect(byKind.contract?.label).toBe(
			`#${contractNumber} · ${prefix} Contract`,
		);
		expect(byKind.project?.label).toBe(`${prefix} Project`);

		await db.recentRecord.deleteMany({ where: { userId: ownerId } });
	});

	it("drops a deleted record from the list and deletes its row", async () => {
		const goneDeal = await db.deal.create({
			data: {
				name: `${prefix} Gone Deal`,
				ownerId,
				stageId,
				currency: "USD",
			},
			select: { id: true },
		});

		await recents.touch({ kind: "deal", recordId: goneDeal.id }, ownerId);
		await db.deal.delete({ where: { id: goneDeal.id } });

		const { rows } = await recents.list(ownerId);
		expect(rows.some((row) => row.recordId === goneDeal.id)).toBe(false);

		const stillThere = await db.recentRecord.findUnique({
			where: {
				userId_kind_recordId: {
					userId: ownerId,
					kind: "deal",
					recordId: goneDeal.id,
				},
			},
		});
		expect(stillThere).toBeNull();
	});

	it("keeps one user's ring invisible to another", async () => {
		await db.recentRecord.deleteMany({
			where: { userId: { in: [ownerId, otherUserId] } },
		});

		await recents.touch({ kind: "deal", recordId: dealId }, ownerId);

		const otherList = await recents.list(otherUserId);
		expect(otherList.rows).toEqual([]);

		await recents.touch({ kind: "contact", recordId: contactId }, otherUserId);
		const ownerList = await recents.list(ownerId);
		expect(ownerList.rows.some((row) => row.kind === "contact")).toBe(false);

		await db.recentRecord.deleteMany({
			where: { userId: { in: [ownerId, otherUserId] } },
		});
	});
});
