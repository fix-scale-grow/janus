import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { SETTINGS_ID, writeReportingCurrency } from "@crm/db/settings";
import { ConversionService } from "../src/currency/conversion.service";
import { PermissionsService } from "../src/permissions/permissions.service";
import { toDay } from "../src/projects/projects.contracts";
import { ReportsService } from "../src/reports/reports.service";

const suffix = process.env.TEST_RUN_ID ?? "reports-ops-spec";

const permissions = new PermissionsService(db);
const conversion = new ConversionService(db);
const service = new ReportsService(db, permissions, conversion);

let adminUserId: string;
let memberUserId: string;
let forbiddenUserId: string;
let previousReportingCurrency: string | null = null;

const dealIds: string[] = [];
const contactIds: string[] = [];
const pipelineIds: string[] = [];
const jurisdictionIds: string[] = [];
const permitIds: string[] = [];
const projectIds: string[] = [];
const crewIds: string[] = [];
const formIds: string[] = [];
const estimateIds: string[] = [];

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

	const existingSetting = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { reportingCurrency: true },
	});
	previousReportingCurrency = existingSetting?.reportingCurrency ?? null;
	await writeReportingCurrency(db, "USD");

	const admin = await db.user.create({
		data: {
			id: `reports-ops-admin-${suffix}`,
			name: "Reports Ops Admin",
			email: `reports-ops-admin-${suffix}@example.test`,
		},
		select: { id: true },
	});
	adminUserId = admin.id;

	const member = await db.user.create({
		data: {
			id: `reports-ops-member-${suffix}`,
			name: "Reports Ops Member",
			email: `reports-ops-member-${suffix}@example.test`,
		},
		select: { id: true },
	});
	memberUserId = member.id;

	const forbidden = await db.user.create({
		data: {
			id: `reports-ops-forbidden-${suffix}`,
			name: "Reports Ops Forbidden",
			email: `reports-ops-forbidden-${suffix}@example.test`,
		},
		select: { id: true },
	});
	forbiddenUserId = forbidden.id;

	await db.member.create({
		data: {
			id: `reports-ops-admin-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: adminUserId,
			role: "admin",
			createdAt: new Date(),
		},
	});
	await db.member.create({
		data: {
			id: `reports-ops-member-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: memberUserId,
			role: "member",
			createdAt: new Date(),
		},
	});
	await db.member.create({
		data: {
			id: `reports-ops-forbidden-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId: forbiddenUserId,
			role: "member",
			createdAt: new Date(),
		},
	});

	await permissions.grant(adminUserId, {
		userId: memberUserId,
		key: "profit.view",
	});
});

afterAll(async () => {
	await db.permitInspection.deleteMany({
		where: { permitId: { in: permitIds } },
	});
	await db.permit.deleteMany({ where: { id: { in: permitIds } } });
	await db.jurisdiction.deleteMany({ where: { id: { in: jurisdictionIds } } });
	await db.projectTask.deleteMany({ where: { projectId: { in: projectIds } } });
	await db.project.deleteMany({ where: { id: { in: projectIds } } });
	await db.crew.deleteMany({ where: { id: { in: crewIds } } });
	await db.estimateLineItem.deleteMany({
		where: { estimateId: { in: estimateIds } },
	});
	await db.estimate.deleteMany({ where: { id: { in: estimateIds } } });
	await db.formSubmission.deleteMany({ where: { formId: { in: formIds } } });
	await db.form.deleteMany({ where: { id: { in: formIds } } });
	await db.trackedVisitor.deleteMany({
		where: { contactId: { in: contactIds } },
	});
	await db.activity.deleteMany({ where: { dealId: { in: dealIds } } });
	await db.dealContact.deleteMany({ where: { dealId: { in: dealIds } } });
	await db.deal.deleteMany({ where: { id: { in: dealIds } } });
	await db.contact.deleteMany({ where: { id: { in: contactIds } } });
	await db.stage.deleteMany({ where: { pipelineId: { in: pipelineIds } } });
	await db.pipeline.deleteMany({ where: { id: { in: pipelineIds } } });
	await db.userPermission.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId, forbiddenUserId] } },
	});
	await db.member.deleteMany({
		where: { userId: { in: [adminUserId, memberUserId, forbiddenUserId] } },
	});
	await db.user.deleteMany({
		where: { id: { in: [adminUserId, memberUserId, forbiddenUserId] } },
	});

	if (previousReportingCurrency) {
		await writeReportingCurrency(db, previousReportingCurrency);
	}
});

async function createDeal(data: {
	id: string;
	name: string;
	ownerId: string;
	stageId: string;
	closedAt?: Date | null;
	closedReason?: string | null;
	amount?: number;
	baseAmount?: number;
	baseCurrency?: string | null;
	createdAt?: Date;
	productionStage?:
		| "SCHEDULED"
		| "IN_PROGRESS"
		| "ON_HOLD"
		| "COMPLETE"
		| "PAID";
	productionStageChangedAt?: Date;
}) {
	const deal = await db.deal.create({
		data: {
			id: data.id,
			name: data.name,
			ownerId: data.ownerId,
			currency: "USD",
			stageId: data.stageId,
			closedAt: data.closedAt ?? undefined,
			closedReason: data.closedReason ?? undefined,
			amount: data.amount ?? undefined,
			baseAmount: data.baseAmount ?? undefined,
			baseCurrency: data.baseCurrency === undefined ? "USD" : data.baseCurrency,
			createdAt: data.createdAt ?? undefined,
			productionStage: data.productionStage ?? undefined,
			productionStageChangedAt: data.productionStageChangedAt ?? undefined,
		},
		select: { id: true },
	});
	dealIds.push(deal.id);
	return deal.id;
}

describe("reports.leaderboard", () => {
	const from = new Date("2024-01-01T00:00:00.000Z");
	const to = new Date("2024-01-31T00:00:00.000Z");

	it("attributes wonCents by closedAt (matching dashboard's won definition), masks money without profit.view, and computes winRatePct/openCount/activitiesLogged", async () => {
		const wonStage = await db.stage.findFirstOrThrow({
			where: { key: "CLOSED_WON" },
			select: { id: true },
		});
		const lostStage = await db.stage.findFirstOrThrow({
			where: { key: "CLOSED_LOST" },
			select: { id: true },
		});
		const openStage = await db.stage.findFirstOrThrow({
			where: { key: "DEMO_BOOKED" },
			select: { id: true },
		});

		await createDeal({
			id: `reports-ops-lb-won-${suffix}`,
			name: "Leaderboard Won",
			ownerId: adminUserId,
			stageId: wonStage.id,
			closedAt: new Date("2024-01-10T00:00:00.000Z"),
			amount: 5000,
			baseAmount: 5000,
			baseCurrency: "USD",
		});
		await createDeal({
			id: `reports-ops-lb-won-outside-${suffix}`,
			name: "Leaderboard Won Outside Range",
			ownerId: adminUserId,
			stageId: wonStage.id,
			closedAt: new Date("2023-06-01T00:00:00.000Z"),
			amount: 9999,
			baseAmount: 9999,
			baseCurrency: "USD",
		});
		await createDeal({
			id: `reports-ops-lb-lost-${suffix}`,
			name: "Leaderboard Lost",
			ownerId: adminUserId,
			stageId: lostStage.id,
			closedAt: new Date("2024-01-15T00:00:00.000Z"),
			closedReason: "Price",
		});
		await createDeal({
			id: `reports-ops-lb-open-${suffix}`,
			name: "Leaderboard Open",
			ownerId: adminUserId,
			stageId: openStage.id,
		});

		await db.activity.create({
			data: {
				type: "NOTE",
				subject: "Called",
				occurredAt: new Date("2024-01-12T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: `reports-ops-lb-won-${suffix}`,
			},
		});
		await db.activity.create({
			data: {
				type: "NOTE",
				subject: "Outside range",
				occurredAt: new Date("2023-01-12T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: `reports-ops-lb-won-${suffix}`,
			},
		});

		const asAdmin = await service.leaderboard(adminUserId, { from, to });
		const adminRow = asAdmin.rows.find((row) => row.userId === adminUserId);
		if (!adminRow) throw new Error("expected a row for the admin owner");

		expect(adminRow.wonCount).toBe(1);
		expect(adminRow.wonCents).toBe(500000);
		expect(adminRow.openCount).toBe(1);
		expect(adminRow.winRatePct).toBeCloseTo(50, 5);
		expect(adminRow.activitiesLogged).toBe(1);

		const asForbidden = await service.leaderboard(forbiddenUserId, {
			from,
			to,
		});
		const forbiddenRow = asForbidden.rows.find(
			(row) => row.userId === adminUserId,
		);
		if (!forbiddenRow) throw new Error("expected a row for the admin owner");
		expect(forbiddenRow.wonCents).toBeNull();
		expect(forbiddenRow.wonCount).toBe(1);
	});
});

describe("reports.pipeline", () => {
	const from = new Date("2031-02-01T00:00:00.000Z");
	const to = new Date("2031-02-28T00:00:00.000Z");

	it("counts deals passing through a stage from STAGE_CHANGE activity, computes conversion and avgDaysInStage, rolls up loss reasons, and skips an unparseable meta row without throwing", async () => {
		const demoBooked = await db.stage.findFirstOrThrow({
			where: { key: "DEMO_BOOKED" },
			select: { id: true, key: true },
		});
		const closedWon = await db.stage.findFirstOrThrow({
			where: { key: "CLOSED_WON" },
			select: { id: true },
		});
		const closedLost = await db.stage.findFirstOrThrow({
			where: { key: "CLOSED_LOST" },
			select: { id: true },
		});

		const dealA = await createDeal({
			id: `reports-ops-pipe-a-${suffix}`,
			name: "Pipeline Deal A",
			ownerId: adminUserId,
			stageId: closedWon.id,
			closedAt: new Date("2031-02-06T00:00:00.000Z"),
		});
		const dealB = await createDeal({
			id: `reports-ops-pipe-b-${suffix}`,
			name: "Pipeline Deal B",
			ownerId: adminUserId,
			stageId: closedLost.id,
			closedAt: new Date("2031-02-04T00:00:00.000Z"),
			closedReason: "Price",
		});
		const dealC = await createDeal({
			id: `reports-ops-pipe-c-${suffix}`,
			name: "Pipeline Deal C (bad meta)",
			ownerId: adminUserId,
			stageId: demoBooked.id,
		});

		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Stage changed",
				occurredAt: new Date("2031-02-01T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealA,
				meta: { from: "DEMO_BOOKED", to: "QUALIFIED_TO_BUY" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Stage changed",
				occurredAt: new Date("2031-02-06T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealA,
				meta: { from: "QUALIFIED_TO_BUY", to: "CLOSED_WON" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Stage changed",
				occurredAt: new Date("2031-02-01T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealB,
				meta: { from: "DEMO_BOOKED", to: "QUALIFIED_TO_BUY" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Stage changed",
				occurredAt: new Date("2031-02-04T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealB,
				meta: { from: "QUALIFIED_TO_BUY", to: "CLOSED_LOST" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Unparseable stage change",
				occurredAt: new Date("2031-02-02T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealC,
				meta: { from: "DEMO_BOOKED", to: "QUALIFIED_TO_BUY", extra: "nope" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Production stage change",
				occurredAt: new Date("2031-02-02T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealC,
				meta: { kind: "production", from: "SCHEDULED", to: "COMPLETE" },
			},
		});

		const result = await service.pipeline(adminUserId, { from, to });
		const sales = result.pipelines.find(
			(pipeline) => pipeline.pipelineName === "Sales",
		);
		if (!sales) throw new Error("expected the seeded Sales pipeline");

		const qualifiedRow = sales.stages.find(
			(stage) => stage.stageKey === "QUALIFIED_TO_BUY",
		);
		if (!qualifiedRow) throw new Error("expected a QUALIFIED_TO_BUY row");
		expect(qualifiedRow.count).toBe(2);
		expect(qualifiedRow.avgDaysInStage).toBeCloseTo(4, 5);

		const wonRow = sales.stages.find(
			(stage) => stage.stageKey === "CLOSED_WON",
		);
		const lostRow = sales.stages.find(
			(stage) => stage.stageKey === "CLOSED_LOST",
		);
		if (!wonRow || !lostRow) throw new Error("expected won and lost rows");
		expect(wonRow.count).toBe(1);
		expect(lostRow.count).toBe(1);

		const demoRow = sales.stages.find(
			(stage) => stage.stageKey === "DEMO_BOOKED",
		);
		if (!demoRow) throw new Error("expected a DEMO_BOOKED row");
		expect(demoRow.count).toBe(0);
		expect(qualifiedRow.conversionPct).toBeNull();

		expect(sales.lossReasons).toContainEqual({ reason: "Price", count: 1 });
	});

	it("computes the estimates funnel (sent/accepted/declined, byTier value masked without profit.view, excluded non-USD, avgDaysToAccept)", async () => {
		const from = new Date("2031-03-01T00:00:00.000Z");
		const to = new Date("2031-03-31T00:00:00.000Z");

		async function createEstimate(data: {
			id: string;
			status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED";
			currency: string;
			selectedTier: "GOOD" | "BETTER" | "BEST";
			createdAt: Date;
			updatedAt: Date;
			priceBetterCents: number;
		}) {
			const estimate = await db.estimate.create({
				data: {
					id: data.id,
					status: data.status,
					currency: data.currency,
					selectedTier: data.selectedTier,
					createdById: adminUserId,
					createdAt: data.createdAt,
					updatedAt: data.updatedAt,
				},
				select: { id: true },
			});
			await db.estimateLineItem.create({
				data: {
					estimateId: estimate.id,
					name: "Roof",
					unit: "FLAT",
					quantity: 1,
					priceGoodCents: 1000,
					priceBetterCents: data.priceBetterCents,
					priceBestCents: 4000,
				},
			});
			estimateIds.push(estimate.id);
			return estimate.id;
		}

		await createEstimate({
			id: `reports-ops-est-sent-${suffix}`,
			status: "SENT",
			currency: "USD",
			selectedTier: "BETTER",
			createdAt: new Date("2031-03-01T00:00:00.000Z"),
			updatedAt: new Date("2031-03-01T00:00:00.000Z"),
			priceBetterCents: 1500,
		});
		await createEstimate({
			id: `reports-ops-est-accepted-usd-${suffix}`,
			status: "ACCEPTED",
			currency: "USD",
			selectedTier: "BETTER",
			createdAt: new Date("2031-03-01T00:00:00.000Z"),
			updatedAt: new Date("2031-03-05T00:00:00.000Z"),
			priceBetterCents: 3000,
		});
		await createEstimate({
			id: `reports-ops-est-accepted-eur-${suffix}`,
			status: "ACCEPTED",
			currency: "EUR",
			selectedTier: "BETTER",
			createdAt: new Date("2031-03-01T00:00:00.000Z"),
			updatedAt: new Date("2031-03-03T00:00:00.000Z"),
			priceBetterCents: 3000,
		});
		await createEstimate({
			id: `reports-ops-est-declined-${suffix}`,
			status: "DECLINED",
			currency: "USD",
			selectedTier: "GOOD",
			createdAt: new Date("2031-03-01T00:00:00.000Z"),
			updatedAt: new Date("2031-03-02T00:00:00.000Z"),
			priceBetterCents: 1500,
		});
		await createEstimate({
			id: `reports-ops-est-draft-${suffix}`,
			status: "DRAFT",
			currency: "USD",
			selectedTier: "GOOD",
			createdAt: new Date("2031-03-01T00:00:00.000Z"),
			updatedAt: new Date("2031-03-01T00:00:00.000Z"),
			priceBetterCents: 1500,
		});

		const asAdmin = await service.pipeline(adminUserId, { from, to });
		expect(asAdmin.estimatesFunnel.sentCount).toBe(4);
		expect(asAdmin.estimatesFunnel.acceptedCount).toBe(2);
		expect(asAdmin.estimatesFunnel.declinedCount).toBe(1);
		expect(asAdmin.estimatesFunnel.acceptRatePct).toBeCloseTo(50, 5);
		expect(asAdmin.estimatesFunnel.avgDaysToAccept).toBeCloseTo(3, 5);

		const betterTier = asAdmin.estimatesFunnel.byTier.find(
			(row) => row.tier === "BETTER",
		);
		if (!betterTier) throw new Error("expected a BETTER tier row");
		expect(betterTier.count).toBe(2);
		expect(betterTier.valueCents).toBe(3000);
		expect(asAdmin.excluded).toBeGreaterThanOrEqual(1);

		const asMember = await service.pipeline(forbiddenUserId, { from, to });
		const maskedTier = asMember.estimatesFunnel.byTier.find(
			(row) => row.tier === "BETTER",
		);
		if (!maskedTier) throw new Error("expected a BETTER tier row");
		expect(maskedTier.valueCents).toBeNull();
		expect(maskedTier.count).toBe(2);
	});
});

describe("reports.leadSources", () => {
	const from = new Date("2031-04-01T00:00:00.000Z");
	const to = new Date("2031-04-30T00:00:00.000Z");

	it("dedupes a tracked contact under its tracked label instead of the generic TRACKING bucket, and attributes won value to the deal's primary contact source", async () => {
		const wonStage = await db.stage.findFirstOrThrow({
			where: { key: "CLOSED_WON" },
			select: { id: true },
		});

		const trackedContact = await db.contact.create({
			data: {
				id: `reports-ops-ls-tracked-${suffix}`,
				firstName: "Tracked",
				lastName: "Contact",
				source: "TRACKING",
				createdAt: new Date("2031-04-05T00:00:00.000Z"),
			},
			select: { id: true },
		});
		contactIds.push(trackedContact.id);

		await db.trackedVisitor.create({
			data: {
				id: `reports-ops-visitor-${suffix}`,
				contactId: trackedContact.id,
				firstSource: "Google Ads",
			},
		});

		const untrackedContact = await db.contact.create({
			data: {
				id: `reports-ops-ls-untracked-${suffix}`,
				firstName: "Untracked",
				lastName: "Contact",
				source: "TRACKING",
				createdAt: new Date("2031-04-06T00:00:00.000Z"),
			},
			select: { id: true },
		});
		contactIds.push(untrackedContact.id);

		const manualContact = await db.contact.create({
			data: {
				id: `reports-ops-ls-manual-${suffix}`,
				firstName: "Manual",
				lastName: "Contact",
				source: "MANUAL",
				createdAt: new Date("2031-04-07T00:00:00.000Z"),
			},
			select: { id: true },
		});
		contactIds.push(manualContact.id);

		const dealId = await createDeal({
			id: `reports-ops-ls-deal-${suffix}`,
			name: "Lead Source Deal",
			ownerId: adminUserId,
			stageId: wonStage.id,
			closedAt: new Date("2031-04-20T00:00:00.000Z"),
			amount: 1000,
			baseAmount: 1000,
			baseCurrency: "USD",
			createdAt: new Date("2031-04-10T00:00:00.000Z"),
		});
		await db.dealContact.create({
			data: {
				dealId,
				contactId: trackedContact.id,
				createdAt: new Date("2031-04-10T00:00:00.000Z"),
			},
		});

		const asAdmin = await service.leadSources(adminUserId, { from, to });

		const googleAdsRow = asAdmin.rows.find(
			(row) => row.source === "Google Ads",
		);
		if (!googleAdsRow) throw new Error("expected a Google Ads row");
		expect(googleAdsRow.contacts).toBe(1);
		expect(googleAdsRow.deals).toBe(1);
		expect(googleAdsRow.wonCount).toBe(1);
		expect(googleAdsRow.wonCents).toBe(100000);

		const trackingRow = asAdmin.rows.find((row) => row.source === "TRACKING");
		if (!trackingRow) throw new Error("expected a TRACKING fallback row");
		expect(trackingRow.contacts).toBe(1);

		const manualRow = asAdmin.rows.find((row) => row.source === "MANUAL");
		if (!manualRow) throw new Error("expected a MANUAL row");
		expect(manualRow.contacts).toBe(1);

		const asForbidden = await service.leadSources(forbiddenUserId, {
			from,
			to,
		});
		const maskedRow = asForbidden.rows.find(
			(row) => row.source === "Google Ads",
		);
		if (!maskedRow) throw new Error("expected a Google Ads row");
		expect(maskedRow.wonCents).toBeNull();
		expect(maskedRow.wonCount).toBe(1);
	});

	it("counts a deal under its primary contact's source even when the contact predates the range (deal and contact ranges are independent)", async () => {
		const openStage = await db.stage.findFirstOrThrow({
			where: { key: "DEMO_BOOKED" },
			select: { id: true },
		});

		const outsideRangeContact = await db.contact.create({
			data: {
				id: `reports-ops-ls-outside-range-${suffix}`,
				firstName: "Outside",
				lastName: "Range",
				source: "TRACKING",
				createdAt: new Date("2031-01-01T00:00:00.000Z"),
			},
			select: { id: true },
		});
		contactIds.push(outsideRangeContact.id);

		await db.trackedVisitor.create({
			data: {
				id: `reports-ops-visitor-outside-${suffix}`,
				contactId: outsideRangeContact.id,
				firstSource: "Bing Ads",
			},
		});

		const dealId = await createDeal({
			id: `reports-ops-ls-deal-outside-contact-${suffix}`,
			name: "Deal After Contact Range",
			ownerId: adminUserId,
			stageId: openStage.id,
			createdAt: new Date("2031-04-15T00:00:00.000Z"),
		});
		await db.dealContact.create({
			data: {
				dealId,
				contactId: outsideRangeContact.id,
				createdAt: new Date("2031-04-15T00:00:00.000Z"),
			},
		});

		const result = await service.leadSources(adminUserId, { from, to });
		const bingRow = result.rows.find((row) => row.source === "Bing Ads");
		if (!bingRow)
			throw new Error("expected a Bing Ads row from the deal alone");
		expect(bingRow.contacts).toBe(0);
		expect(bingRow.deals).toBe(1);
	});

	it("attributes wonCount/wonCents by closedAt alone, independent of the deal's createdAt cohort", async () => {
		const wonStage = await db.stage.findFirstOrThrow({
			where: { key: "CLOSED_WON" },
			select: { id: true },
		});

		const wonSourceContact = await db.contact.create({
			data: {
				id: `reports-ops-ls-won-outside-created-${suffix}`,
				firstName: "Won",
				lastName: "OutsideCreated",
				source: "TRACKING",
				createdAt: new Date("2031-02-01T00:00:00.000Z"),
			},
			select: { id: true },
		});
		contactIds.push(wonSourceContact.id);

		await db.trackedVisitor.create({
			data: {
				id: `reports-ops-visitor-won-outside-created-${suffix}`,
				contactId: wonSourceContact.id,
				firstSource: "Direct Mail",
			},
		});

		const dealId = await createDeal({
			id: `reports-ops-ls-deal-won-outside-created-${suffix}`,
			name: "Deal Created Before Range, Closed Inside",
			ownerId: adminUserId,
			stageId: wonStage.id,
			createdAt: new Date("2031-03-01T00:00:00.000Z"),
			closedAt: new Date("2031-04-20T00:00:00.000Z"),
			amount: 2000,
			baseAmount: 2000,
			baseCurrency: "USD",
		});
		await db.dealContact.create({
			data: {
				dealId,
				contactId: wonSourceContact.id,
				createdAt: new Date("2031-03-01T00:00:00.000Z"),
			},
		});

		const result = await service.leadSources(adminUserId, { from, to });
		const directMailRow = result.rows.find(
			(row) => row.source === "Direct Mail",
		);
		if (!directMailRow) throw new Error("expected a Direct Mail row");
		expect(directMailRow.wonCount).toBe(1);
		expect(directMailRow.wonCents).toBe(200000);
		expect(directMailRow.deals).toBe(0);
	});
});

describe("reports.production", () => {
	it("counts deals per production stage, throughput by month, and clips crew task-days to the range", async () => {
		const openStage = await db.stage.findFirstOrThrow({
			where: { key: "DEMO_BOOKED" },
			select: { id: true },
		});
		const from = new Date("2032-06-01T00:00:00.000Z");
		const to = new Date("2032-06-30T00:00:00.000Z");

		const before = await service.production(adminUserId, { from, to });

		await createDeal({
			id: `reports-ops-prod-scheduled-${suffix}`,
			name: "Prod Scheduled",
			ownerId: adminUserId,
			stageId: openStage.id,
			productionStage: "SCHEDULED",
			productionStageChangedAt: new Date("2032-06-01T00:00:00.000Z"),
		});
		await createDeal({
			id: `reports-ops-prod-complete-${suffix}`,
			name: "Prod Complete",
			ownerId: adminUserId,
			stageId: openStage.id,
			productionStage: "COMPLETE",
			productionStageChangedAt: new Date("2032-06-10T00:00:00.000Z"),
		});
		await createDeal({
			id: `reports-ops-prod-paid-${suffix}`,
			name: "Prod Paid",
			ownerId: adminUserId,
			stageId: openStage.id,
			productionStage: "PAID",
			productionStageChangedAt: new Date("2032-06-15T00:00:00.000Z"),
		});
		await createDeal({
			id: `reports-ops-prod-complete-outside-${suffix}`,
			name: "Prod Complete Outside Range",
			ownerId: adminUserId,
			stageId: openStage.id,
			productionStage: "COMPLETE",
			productionStageChangedAt: new Date("2032-05-01T00:00:00.000Z"),
		});

		const project = await db.project.create({
			data: {
				id: `reports-ops-project-${suffix}`,
				name: "Reports Ops Project",
				status: "ACTIVE",
				startDate: new Date("2032-06-01T00:00:00.000Z"),
				createdById: adminUserId,
			},
			select: { id: true },
		});
		projectIds.push(project.id);

		const crew = await db.crew.create({
			data: { id: `reports-ops-crew-${suffix}`, name: "Crew A", color: "red" },
			select: { id: true },
		});
		crewIds.push(crew.id);

		const archivedCrew = await db.crew.create({
			data: {
				id: `reports-ops-crew-archived-${suffix}`,
				name: "Archived Crew",
				color: "gray",
				archived: true,
			},
			select: { id: true },
		});
		crewIds.push(archivedCrew.id);

		await db.projectTask.create({
			data: {
				projectId: project.id,
				crewId: crew.id,
				name: "Task fully inside",
				startDay: new Date("2032-06-05T00:00:00.000Z"),
				endDay: new Date("2032-06-07T00:00:00.000Z"),
				status: "DONE",
			},
		});
		await db.projectTask.create({
			data: {
				projectId: project.id,
				crewId: crew.id,
				name: "Task fully inside open",
				startDay: new Date("2032-06-20T00:00:00.000Z"),
				endDay: new Date("2032-06-25T00:00:00.000Z"),
				status: "TODO",
			},
		});
		await db.projectTask.create({
			data: {
				projectId: project.id,
				crewId: crew.id,
				name: "Task clipped at range start",
				startDay: new Date("2032-05-28T00:00:00.000Z"),
				endDay: new Date("2032-06-02T00:00:00.000Z"),
				status: "IN_PROGRESS",
			},
		});
		await db.projectTask.create({
			data: {
				projectId: project.id,
				crewId: crew.id,
				name: "Task fully outside range",
				startDay: new Date("2032-07-05T00:00:00.000Z"),
				endDay: new Date("2032-07-06T00:00:00.000Z"),
				status: "TODO",
			},
		});
		await db.projectTask.create({
			data: {
				projectId: project.id,
				crewId: archivedCrew.id,
				name: "Archived crew task",
				startDay: new Date("2032-06-05T00:00:00.000Z"),
				endDay: new Date("2032-06-07T00:00:00.000Z"),
				status: "DONE",
			},
		});

		const after = await service.production(adminUserId, { from, to });

		const stageOf = (stage: string) =>
			after.stageCounts.find((row) => row.stage === stage)?.count ?? 0;
		const beforeStageOf = (stage: string) =>
			before.stageCounts.find((row) => row.stage === stage)?.count ?? 0;

		expect(stageOf("SCHEDULED") - beforeStageOf("SCHEDULED")).toBe(1);
		expect(stageOf("COMPLETE") - beforeStageOf("COMPLETE")).toBe(2);
		expect(stageOf("PAID") - beforeStageOf("PAID")).toBe(1);

		const juneThroughput = after.throughputByMonth.find(
			(row) => row.month === "2032-06",
		);
		if (!juneThroughput) throw new Error("expected a 2032-06 row");
		expect(juneThroughput.count).toBe(2);

		expect(after.avgScheduledToCompleteDays).toBeNull();

		const crewRow = after.crews.find((row) => row.crewId === crew.id);
		if (!crewRow) throw new Error("expected a row for the unarchived crew");
		expect(crewRow.taskCount).toBe(3);
		expect(crewRow.taskDays).toBe(3 + 6 + 2);
		expect(crewRow.doneCount).toBe(1);
		expect(crewRow.openCount).toBe(2);

		expect(
			after.crews.find((row) => row.crewId === archivedCrew.id),
		).toBeUndefined();
	});

	it("averages SCHEDULED-to-COMPLETE days from production STAGE_CHANGE activity history", async () => {
		const openStage = await db.stage.findFirstOrThrow({
			where: { key: "DEMO_BOOKED" },
			select: { id: true },
		});
		const from = new Date("2034-01-01T00:00:00.000Z");
		const to = new Date("2034-01-31T00:00:00.000Z");

		const dealFast = await createDeal({
			id: `reports-ops-prod-cycle-fast-${suffix}`,
			name: "Prod Cycle Fast",
			ownerId: adminUserId,
			stageId: openStage.id,
		});
		const dealSlow = await createDeal({
			id: `reports-ops-prod-cycle-slow-${suffix}`,
			name: "Prod Cycle Slow",
			ownerId: adminUserId,
			stageId: openStage.id,
		});
		const dealNoComplete = await createDeal({
			id: `reports-ops-prod-cycle-nocomplete-${suffix}`,
			name: "Prod Cycle No Complete",
			ownerId: adminUserId,
			stageId: openStage.id,
		});

		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Production stage changed",
				occurredAt: new Date("2034-01-01T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealFast,
				meta: { kind: "production", from: null, to: "SCHEDULED" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Production stage changed",
				occurredAt: new Date("2034-01-04T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealFast,
				meta: {
					kind: "production",
					from: "SCHEDULED",
					to: "COMPLETE",
					auto: true,
				},
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Production stage changed",
				occurredAt: new Date("2034-01-05T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealSlow,
				meta: { kind: "production", from: null, to: "SCHEDULED" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Production stage changed",
				occurredAt: new Date("2034-01-15T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealSlow,
				meta: { kind: "production", from: "SCHEDULED", to: "COMPLETE" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Pipeline stage changed (must not interfere)",
				occurredAt: new Date("2034-01-06T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealSlow,
				meta: { from: "DEMO_BOOKED", to: "QUALIFIED_TO_BUY" },
			},
		});
		await db.activity.create({
			data: {
				type: "STAGE_CHANGE",
				subject: "Production stage changed",
				occurredAt: new Date("2034-01-02T00:00:00.000Z"),
				createdById: adminUserId,
				dealId: dealNoComplete,
				meta: { kind: "production", from: null, to: "SCHEDULED" },
			},
		});

		const result = await service.production(adminUserId, { from, to });
		expect(result.avgScheduledToCompleteDays).toBeCloseTo((3 + 10) / 2, 5);
	});
});

describe("reports.permits", () => {
	const from = new Date("2033-01-01T00:00:00.000Z");
	const to = new Date("2033-12-31T00:00:00.000Z");

	it("computes avg submitted-to-issued days per jurisdiction, inspection pass rate, fees total (masked without profit.view), and the expiring window", async () => {
		const openStage = await db.stage.findFirstOrThrow({
			where: { key: "DEMO_BOOKED" },
			select: { id: true },
		});
		const dealId = await createDeal({
			id: `reports-ops-permit-deal-${suffix}`,
			name: "Permit Deal",
			ownerId: adminUserId,
			stageId: openStage.id,
		});

		const jurisdiction = await db.jurisdiction.create({
			data: {
				name: `Reports Ops County ${suffix}`,
				kind: "COUNTY",
				state: "CO",
				matchKey: `reports-ops-jurisdiction-${suffix}`,
			},
			select: { id: true },
		});
		jurisdictionIds.push(jurisdiction.id);

		async function createPermit(data: {
			id: string;
			status:
				| "DRAFT"
				| "READY_TO_SUBMIT"
				| "SUBMITTED"
				| "ISSUED"
				| "INSPECTIONS"
				| "CLOSED"
				| "DENIED"
				| "EXPIRED";
			submittedAt?: Date;
			issuedAt?: Date;
			expiresAt?: Date;
			feeCents?: number;
		}) {
			const permit = await db.permit.create({
				data: {
					id: data.id,
					dealId,
					jurisdictionId: jurisdiction.id,
					status: data.status,
					permitType: "ROOFING",
					createdById: adminUserId,
					submittedAt: data.submittedAt,
					issuedAt: data.issuedAt,
					expiresAt: data.expiresAt,
					feeCents: data.feeCents,
				},
				select: { id: true },
			});
			permitIds.push(permit.id);
			return permit.id;
		}

		const permitOne = await createPermit({
			id: `reports-ops-permit-1-${suffix}`,
			status: "CLOSED",
			submittedAt: new Date("2033-01-01T00:00:00.000Z"),
			issuedAt: new Date("2033-01-11T00:00:00.000Z"),
			feeCents: 5000,
		});
		await createPermit({
			id: `reports-ops-permit-2-${suffix}`,
			status: "CLOSED",
			submittedAt: new Date("2033-01-01T00:00:00.000Z"),
			issuedAt: new Date("2033-01-21T00:00:00.000Z"),
			feeCents: 3000,
		});

		await db.permitInspection.create({
			data: {
				permitId: permitOne,
				name: "Framing",
				result: "PASSED",
				scheduledFor: new Date("2033-01-15T00:00:00.000Z"),
			},
		});
		await db.permitInspection.create({
			data: {
				permitId: permitOne,
				name: "Final",
				result: "FAILED",
				scheduledFor: new Date("2033-01-16T00:00:00.000Z"),
			},
		});
		await db.permitInspection.create({
			data: {
				permitId: permitOne,
				name: "Pending",
				result: "PENDING",
				scheduledFor: new Date("2033-01-17T00:00:00.000Z"),
			},
		});

		const asAdmin = await service.permits(adminUserId, { from, to });
		const jurisdictionRow = asAdmin.cycleDaysByJurisdiction.find(
			(row) => row.jurisdictionId === jurisdiction.id,
		);
		if (!jurisdictionRow) throw new Error("expected a jurisdiction row");
		expect(jurisdictionRow.avgDays).toBeCloseTo(15, 5);
		expect(asAdmin.inspectionPassRatePct).toBeCloseTo(50, 5);
		expect(asAdmin.feesCents).toBe(8000);

		const asForbidden = await service.permits(forbiddenUserId, { from, to });
		expect(asForbidden.feesCents).toBeNull();

		const todayUtc = toDay(new Date());
		const dayMs = 24 * 60 * 60 * 1000;
		const exactlyThirtyDaysOut = new Date(todayUtc.getTime() + 30 * dayMs);
		const thirtyOneDaysOut = new Date(todayUtc.getTime() + 31 * dayMs);

		const exactlyAtWindowEdge = await createPermit({
			id: `reports-ops-permit-expiring-edge-${suffix}`,
			status: "ISSUED",
			expiresAt: exactlyThirtyDaysOut,
		});
		const justPastWindow = await createPermit({
			id: `reports-ops-permit-not-expiring-${suffix}`,
			status: "ISSUED",
			expiresAt: thirtyOneDaysOut,
		});

		const alreadyExpired = await createPermit({
			id: `reports-ops-permit-already-expired-${suffix}`,
			status: "ISSUED",
			expiresAt: new Date(todayUtc.getTime() - 5 * dayMs),
		});

		const withExpiring = await service.permits(adminUserId, { from, to });
		expect(
			withExpiring.expiring.some((row) => row.permitId === exactlyAtWindowEdge),
		).toBe(true);
		expect(
			withExpiring.expiring.some((row) => row.permitId === justPastWindow),
		).toBe(false);
		expect(
			withExpiring.expiring.some((row) => row.permitId === alreadyExpired),
		).toBe(false);
	});
});
