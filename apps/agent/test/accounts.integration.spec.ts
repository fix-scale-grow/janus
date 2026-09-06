import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ActivityType, DealStage, db, EmailDirection } from "@crm/db";
import { readDealHistory } from "../agent/lib/accounts";

const suffix = process.env.TEST_RUN_ID ?? "accounts-spec";
const domain = `fernhill-${suffix}.test`;

let dealId: string;
let paulaId: string;
let userId: string;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000);

beforeAll(async () => {
	await cleanup();

	const user = await db.user.create({
		data: {
			id: `user-${suffix}`,
			name: "Rep One",
			email: `rep.${suffix}@example.test`,
			emailVerified: true,
		},
		select: { id: true },
	});
	userId = user.id;

	const paula = await db.contact.create({
		data: {
			firstName: "Paula",
			lastName: "Marchetti",
			title: "Growth Specialist",
			email: `paula.marchetti@${domain}`,
			companyName: `Fernhill Systems ${suffix}`,
			lastActivityAt: daysAgo(1),
		},
		select: { id: true },
	});
	paulaId = paula.id;

	const deal = await db.deal.create({
		data: {
			name: `Fernhill platform ${suffix}`,
			ownerId: userId,
			stage: DealStage.CONTRACT_SENT,
			stageChangedAt: daysAgo(42),
			amount: 48_000,
			currency: "USD",
			expectedCloseDate: daysAhead(14),
			lastActivityAt: daysAgo(3),
			contacts: { create: [{ contactId: paulaId, role: "Champion" }] },
		},
		select: { id: true },
	});
	dealId = deal.id;

	await db.activity.createMany({
		data: [
			{
				type: ActivityType.STAGE_CHANGE,
				subject: "Stage changed",
				dealId,
				createdById: userId,
				createdAt: daysAgo(60),
				meta: { from: "DEMO_BOOKED", to: "QUALIFIED_TO_BUY" },
			},
			{
				type: ActivityType.STAGE_CHANGE,
				subject: "Stage changed",
				dealId,
				createdById: userId,
				createdAt: daysAgo(42),
				meta: { from: "QUALIFIED_TO_BUY", to: "CONTRACT_SENT" },
			},
			{
				type: ActivityType.NOTE,
				subject: "Pricing pushback",
				body: "They want the security review done before signing.",
				occurredAt: daysAgo(5),
				dealId,
				createdById: userId,
			},
			{
				type: ActivityType.EMAIL,
				subject: "Re: Contract",
				dealId,
				createdById: userId,
			},
		],
	});

	const thread = await db.emailThread.create({
		data: {
			rootMessageId: `<root.${suffix}@example.test>`,
			subject: "Re: Contract",
			contactId: paulaId,
			firstMessageAt: daysAgo(9),
			lastMessageAt: daysAgo(3),
			messageCount: 2,
		},
		select: { id: true },
	});

	await db.emailMessage.createMany({
		data: [
			{
				threadId: thread.id,
				rfcMessageId: `<out.${suffix}@example.test>`,
				direction: EmailDirection.OUTBOUND,
				fromEmail: `rep.${suffix}@example.test`,
				recipients: [],
				subject: "Contract",
				body: "Sending the paperwork over.",
				sentAt: daysAgo(9),
			},
			{
				threadId: thread.id,
				rfcMessageId: `<in.${suffix}@example.test>`,
				direction: EmailDirection.INBOUND,
				fromEmail: `paula.marchetti@${domain}`,
				fromName: "Paula Marchetti",
				recipients: [],
				subject: "Re: Contract",
				body: "Thanks — Paula Marchetti, Growth Specialist, Fernhill.",
				sentAt: daysAgo(3),
			},
		],
	});

	await db.calendarEvent.create({
		data: {
			iCalUid: `event.${suffix}@example.test`,
			originalStartTime: daysAhead(4),
			title: "Security review",
			startsAt: daysAhead(4),
			endsAt: daysAhead(4),
			status: "confirmed",
			contactId: paulaId,
			attendees: {
				create: [
					{ email: `paula.marchetti@${domain}`, name: "Paula Marchetti" },
				],
			},
		},
	});
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.emailThread.deleteMany({
		where: { rootMessageId: { contains: suffix } },
	});
	await db.calendarEvent.deleteMany({
		where: { iCalUid: { contains: suffix } },
	});
	await db.deal.deleteMany({ where: { name: { contains: suffix } } });
	await db.contact.deleteMany({ where: { email: { contains: suffix } } });
	await db.user.deleteMany({ where: { email: `rep.${suffix}@example.test` } });
}

describe("readDealHistory", () => {
	it("reports the stage clock, not just the stage", async () => {
		const history = await readDealHistory(dealId);

		expect(history?.deal.stage).toBe("CONTRACT_SENT");
		expect(history?.deal.open).toBe(true);
		expect(history?.deal.daysInStage).toBeGreaterThanOrEqual(41);
	});

	it("returns every stage it moved through, oldest first", async () => {
		const history = await readDealHistory(dealId);

		expect(history?.stageHistory.map((change) => change.to)).toEqual([
			"QUALIFIED_TO_BUY",
			"CONTRACT_SENT",
		]);
	});

	it("names who is on it, with ids and roles", async () => {
		const history = await readDealHistory(dealId);

		expect(history?.people).toEqual([
			{
				id: paulaId,
				name: "Paula Marchetti",
				title: "Growth Specialist",
				email: `paula.marchetti@${domain}`,
				role: "Champion",
			},
		]);
	});

	it("says the correspondence belongs to the people on it, not the deal", async () => {
		const history = await readDealHistory(dealId);

		expect(history?.threads).toHaveLength(1);
		expect(history?.stats.theyReplied).toBe(true);
		expect(history?.note).toContain("never against a deal");
	});

	it("omits deal correspondence when connected sources are not approved", async () => {
		const history = await readDealHistory(dealId, {
			includeEmail: false,
			includeCalendar: false,
		});

		expect(history?.threads).toEqual([]);
		expect(history?.meetings).toEqual([]);
		expect(history?.stats.theyReplied).toBe(false);
		expect(history?.stats.nextMeetingAt).toBeNull();
		expect(history?.note).toContain("outside this agent version");
	});

	it("returns null for a deal that does not exist", async () => {
		expect(await readDealHistory("nope")).toBeNull();
	});
});
