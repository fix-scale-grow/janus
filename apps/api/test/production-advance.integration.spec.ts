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
import type { ProductionStage } from "@crm/db/enums";
import { canAutoAdvance } from "@crm/db/production-semantics";
import { ProductionAdvanceService } from "../src/production/production-advance.service";
import { ProjectsService } from "../src/projects/projects.service";

const suffix = process.env.TEST_RUN_ID ?? "production-spec";

const production = new ProductionAdvanceService(db);
const projects = new ProjectsService(db, production);
const ADMIN = adminPrincipal("test");

let userId: string;
let wonStageId: string;
let openStageId: string;
let dealId: string;
let openDealId: string;

async function resetDeal(stage: ProductionStage | null = null) {
	await db.deal.update({
		where: { id: dealId },
		data: { productionStage: stage },
	});
}

async function productionStageOf(id: string) {
	const deal = await db.deal.findUniqueOrThrow({
		where: { id },
		select: { productionStage: true },
	});
	return deal.productionStage;
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

	const user = await db.user.create({
		data: {
			id: `production-user-${suffix}`,
			name: "Production User",
			email: `production-user-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	const won = await db.stage.findFirstOrThrow({
		where: { outcome: "WON" },
		select: { id: true },
	});
	wonStageId = won.id;

	const open = await db.stage.findFirstOrThrow({
		where: { outcome: "OPEN" },
		select: { id: true },
	});
	openStageId = open.id;

	const deal = await db.deal.create({
		data: {
			id: `production-deal-${suffix}`,
			name: `Production Deal ${suffix}`,
			ownerId: userId,
			currency: "USD",
			stageId: wonStageId,
		},
		select: { id: true },
	});
	dealId = deal.id;

	const openDeal = await db.deal.create({
		data: {
			id: `production-open-deal-${suffix}`,
			name: `Production Open Deal ${suffix}`,
			ownerId: userId,
			currency: "USD",
			stageId: openStageId,
		},
		select: { id: true },
	});
	openDealId = openDeal.id;
});

afterAll(async () => {
	await db.projectTask.deleteMany({
		where: { project: { dealId: { in: [dealId, openDealId] } } },
	});
	await db.project.deleteMany({
		where: { dealId: { in: [dealId, openDealId] } },
	});
	await db.invoice.deleteMany({
		where: { dealId: { in: [dealId, openDealId] } },
	});
	await db.activity.deleteMany({
		where: { dealId: { in: [dealId, openDealId] } },
	});
	await db.deal.deleteMany({ where: { id: { in: [dealId, openDealId] } } });
	await db.user.deleteMany({ where: { id: userId } });
});

beforeEach(async () => {
	await db.projectTask.deleteMany({
		where: { project: { dealId: { in: [dealId, openDealId] } } },
	});
	await db.project.deleteMany({
		where: { dealId: { in: [dealId, openDealId] } },
	});
	await db.invoice.deleteMany({
		where: { dealId: { in: [dealId, openDealId] } },
	});
	await resetDeal(null);
});

describe("canAutoAdvance", () => {
	it("moves forward only", () => {
		expect(canAutoAdvance(null, "SCHEDULED")).toBe(true);
		expect(canAutoAdvance("SCHEDULED", "IN_PROGRESS")).toBe(true);
		expect(canAutoAdvance("IN_PROGRESS", "COMPLETE")).toBe(true);
		expect(canAutoAdvance("COMPLETE", "PAID")).toBe(true);
		expect(canAutoAdvance(null, "PAID")).toBe(true);
		expect(canAutoAdvance("PAID", "IN_PROGRESS")).toBe(false);
		expect(canAutoAdvance("COMPLETE", "SCHEDULED")).toBe(false);
		expect(canAutoAdvance("SCHEDULED", "SCHEDULED")).toBe(false);
	});

	it("never moves a job that is on hold", () => {
		expect(canAutoAdvance("ON_HOLD", "IN_PROGRESS")).toBe(false);
		expect(canAutoAdvance("ON_HOLD", "PAID")).toBe(false);
	});
});

describe("ProductionAdvanceService.advance", () => {
	it("advances a won deal and logs an activity", async () => {
		await production.advance(dealId, "SCHEDULED", userId);
		expect(await productionStageOf(dealId)).toBe("SCHEDULED");

		const activity = await db.activity.findFirst({
			where: { dealId, type: "STAGE_CHANGE" },
			orderBy: { occurredAt: "desc" },
			select: { meta: true },
		});
		expect(activity?.meta).toMatchObject({
			kind: "production",
			to: "SCHEDULED",
			auto: true,
		});
	});

	it("ignores a deal that is not won", async () => {
		await production.advance(openDealId, "SCHEDULED", userId);
		expect(await productionStageOf(openDealId)).toBeNull();
	});

	it("never moves backward or out of on hold", async () => {
		await resetDeal("COMPLETE");
		await production.advance(dealId, "IN_PROGRESS", userId);
		expect(await productionStageOf(dealId)).toBe("COMPLETE");

		await resetDeal("ON_HOLD");
		await production.advance(dealId, "PAID", userId);
		expect(await productionStageOf(dealId)).toBe("ON_HOLD");
	});
});

describe("ProductionAdvanceService.advanceWhenPaid", () => {
	it("moves to PAID when every open invoice is paid", async () => {
		await db.invoice.create({
			data: {
				dealId,
				createdById: userId,
				status: "PAID",
				paidAt: new Date(),
			},
		});
		await db.invoice.create({
			data: { dealId, createdById: userId, status: "VOID" },
		});
		await production.advanceWhenPaid(dealId, userId);
		expect(await productionStageOf(dealId)).toBe("PAID");
	});

	it("stays put while an invoice is unpaid", async () => {
		await db.invoice.create({
			data: {
				dealId,
				createdById: userId,
				status: "PAID",
				paidAt: new Date(),
			},
		});
		await db.invoice.create({
			data: { dealId, createdById: userId, status: "SENT" },
		});
		await production.advanceWhenPaid(dealId, userId);
		expect(await productionStageOf(dealId)).toBeNull();
	});

	it("does nothing with no invoices on the deal", async () => {
		await production.advanceWhenPaid(dealId, userId);
		expect(await productionStageOf(dealId)).toBeNull();
	});
});

describe("project activity drives production", () => {
	it("schedules the job when a project is started", async () => {
		await projects.create(
			{
				name: `Production Project ${suffix}`,
				dealId,
				startDate: new Date(),
			},
			userId,
			ADMIN,
		);
		expect(await productionStageOf(dealId)).toBe("SCHEDULED");
	});

	it("moves to IN_PROGRESS when a task starts and COMPLETE when all are done", async () => {
		const project = await projects.create(
			{
				name: `Production Project Tasks ${suffix}`,
				dealId,
				startDate: new Date(),
			},
			userId,
			ADMIN,
		);
		const first = await projects.taskCreate(
			{
				projectId: project.id,
				name: "Tear off",
				endDay: null,
			},
			ADMIN,
		);
		const second = await projects.taskCreate(
			{
				projectId: project.id,
				name: "Install",
				endDay: null,
			},
			ADMIN,
		);

		await projects.taskUpdate(
			{ id: first.id, status: "IN_PROGRESS" },
			userId,
			ADMIN,
		);
		expect(await productionStageOf(dealId)).toBe("IN_PROGRESS");

		await projects.taskUpdate({ id: first.id, status: "DONE" }, userId, ADMIN);
		expect(await productionStageOf(dealId)).toBe("IN_PROGRESS");

		await projects.taskUpdate({ id: second.id, status: "DONE" }, userId, ADMIN);
		expect(await productionStageOf(dealId)).toBe("COMPLETE");
	});
});
