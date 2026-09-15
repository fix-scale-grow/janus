import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { NotFoundException } from "@nestjs/common";
import { ActivitiesService } from "../src/activities/activities.service";
import { ConversationsService } from "../src/conversations/conversations.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { ConversationService } from "../src/google/conversation.service";
import { RecentsService } from "../src/recents/recents.service";
import { SearchService } from "../src/search/search.service";

const suffix = process.env.TEST_RUN_ID ?? "access-leaks";

const search = new SearchService(db);
const recents = new RecentsService(db);
const stamp = new ActivityStampService(db);
const activities = new ActivitiesService(db, stamp);
const conversion = new ConversionService(db);
const dashboard = new DashboardService(db, conversion);
const conversations = new ConversationsService(db);
const google = new ConversationService(db);

let f: AccessFixture;

async function expectNotFound(run: () => Promise<unknown>) {
	try {
		await run();
		throw new Error("expected NotFoundException");
	} catch (error) {
		expect(error).toBeInstanceOf(NotFoundException);
	}
}

beforeAll(async () => {
	f = await createAccessFixture(suffix);
});

afterAll(async () => {
	await f.cleanup();
});

describe("leak paths", () => {
	describe("search", () => {
		test("hides out-of-scope deals and contacts", async () => {
			const result = await search.quick(`${suffix}`, f.clerk);
			const ids = JSON.stringify(result);
			expect(ids).not.toContain(f.otherDealId);
			expect(ids).not.toContain(f.otherContactId);
		});

		test("finds the clerk's own deal by name", async () => {
			const deal = await db.deal.findUniqueOrThrow({
				where: { id: f.clerkDealId },
				select: { name: true },
			});
			const result = await search.quick(deal.name, f.clerk);
			expect(JSON.stringify(result)).toContain(f.clerkDealId);
		});

		test("hides areas the group cannot view", async () => {
			const invoice = await db.invoice.findUniqueOrThrow({
				where: { id: f.clerkInvoiceId },
				select: { number: true },
			});
			const result = await search.quick(String(invoice.number), f.crew);
			expect(JSON.stringify(result)).not.toContain(f.clerkInvoiceId);
		});
	});

	describe("recents", () => {
		test("drop records now out of scope, without deleting the row", async () => {
			await recents.touch({ kind: "deal", recordId: f.clerkDealId }, f.clerk);
			await recents.touch({ kind: "deal", recordId: f.otherDealId }, f.admin);

			const list = await recents.list(f.clerkId, f.clerk);
			expect(JSON.stringify(list)).not.toContain(f.otherDealId);
		});

		test("touch on an out-of-scope record is a silent no-op", async () => {
			await recents.touch({ kind: "deal", recordId: f.otherDealId }, f.clerk);
			const row = await db.recentRecord.findUnique({
				where: {
					userId_kind_recordId: {
						userId: f.clerkId,
						kind: "deal",
						recordId: f.otherDealId,
					},
				},
			});
			expect(row).toBeNull();
		});
	});

	describe("activities", () => {
		test("timeline on another deal is not found", async () => {
			await expectNotFound(() =>
				activities.timeline(
					{ dealId: f.otherDealId, filter: "all", limit: 30 },
					f.clerk,
				),
			);
		});

		test("timelineCounts on another deal is not found", async () => {
			await expectNotFound(() =>
				activities.timelineCounts({ dealId: f.otherDealId }, f.clerk),
			);
		});

		test("creating an activity on another deal is not found", async () => {
			await expectNotFound(() =>
				activities.create(
					{ type: "NOTE", dealId: f.otherDealId, subject: "hi" },
					f.clerkId,
					f.clerk,
				),
			);
		});

		test("completing another deal's task is not found", async () => {
			const task = await db.activity.create({
				data: {
					type: "TASK",
					subject: "Other task",
					dealId: f.otherDealId,
					createdById: f.adminId,
				},
				select: { id: true },
			});
			await expectNotFound(() => activities.complete(task.id, true, f.clerk));
			await db.activity.delete({ where: { id: task.id } });
		});

		test("myTasks only returns tasks whose anchor is in scope", async () => {
			const inScope = await db.activity.create({
				data: {
					type: "TASK",
					subject: "Clerk task",
					dealId: f.clerkDealId,
					createdById: f.clerkId,
				},
				select: { id: true },
			});
			const outOfScope = await db.activity.create({
				data: {
					type: "TASK",
					subject: "Reassigned task",
					dealId: f.otherDealId,
					createdById: f.clerkId,
				},
				select: { id: true },
			});

			const tasks = await activities.myTasks(
				{ window: "all", limit: 25 },
				f.clerkId,
				f.clerk,
			);
			const ids = tasks.map((task) => task.id);
			expect(ids).toContain(inScope.id);
			expect(ids).not.toContain(outOfScope.id);

			await db.activity.deleteMany({
				where: { id: { in: [inScope.id, outOfScope.id] } },
			});
		});
	});

	describe("google", () => {
		test("thread on another deal's email activity is not found", async () => {
			const thread = await db.emailThread.create({
				data: {
					rootMessageId: `root-${suffix}`,
					firstMessageAt: new Date(),
					lastMessageAt: new Date(),
				},
				select: { id: true },
			});
			await db.activity.create({
				data: {
					type: "EMAIL",
					dealId: f.otherDealId,
					createdById: f.adminId,
					emailThreadId: thread.id,
				},
			});

			await expectNotFound(() => google.thread(thread.id, f.clerk));
			expect(await google.thread(thread.id, f.admin)).toBeDefined();

			await db.activity.deleteMany({ where: { emailThreadId: thread.id } });
			await db.emailThread.delete({ where: { id: thread.id } });
		});

		test("event on another deal's calendar activity is not found", async () => {
			const now = new Date();
			const event = await db.calendarEvent.create({
				data: {
					iCalUid: `ical-${suffix}`,
					originalStartTime: now,
					startsAt: now,
					endsAt: now,
					status: "confirmed",
				},
				select: { id: true },
			});
			await db.activity.create({
				data: {
					type: "MEETING",
					dealId: f.otherDealId,
					createdById: f.adminId,
					calendarEventId: event.id,
				},
			});

			await expectNotFound(() => google.event(event.id, f.clerk));
			expect(await google.event(event.id, f.admin)).toBeDefined();

			await db.activity.deleteMany({ where: { calendarEventId: event.id } });
			await db.calendarEvent.delete({ where: { id: event.id } });
		});
	});

	describe("conversations", () => {
		test("listing conversations anchored on another deal is not found", async () => {
			await expectNotFound(() =>
				conversations.list({ dealId: f.otherDealId }, f.clerkId, f.clerk),
			);
		});

		test("listing conversations anchored on the clerk's own deal succeeds", async () => {
			const result = await conversations.list(
				{ dealId: f.clerkDealId },
				f.clerkId,
				f.clerk,
			);
			expect(result).toEqual([]);
		});
	});

	describe("dashboard", () => {
		test("sums only in-scope deals", async () => {
			const summary = await dashboard.summary(
				f.clerkId,
				{ scope: "everyone" },
				f.clerk,
			);
			expect(JSON.stringify(summary).includes(f.otherDealId)).toBe(false);
		});
	});
});
