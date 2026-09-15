import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { type AccessPrincipal, adminPrincipal } from "@crm/db/access-policy";
import { readDealHistory } from "../agent/lib/accounts";
import { listDrawings } from "../agent/lib/drawing-lookup";
import { loadDrawingSummary } from "../agent/lib/drawing-summary";
import { loadEstimateSummary } from "../agent/lib/estimate-summary";
import { listDeals, searchCrm } from "../agent/lib/lookup";
import listDealsTool from "../agent/tools/list_deals";
import readEstimateTool from "../agent/tools/read_estimate";
import searchCrmTool from "../agent/tools/search_crm";
import {
	assertFenced,
	HOSTILE_PAYLOADS,
	LIST_EVERY_DEAL,
	readOtherEstimate,
} from "./injection-fixtures";

const admin = adminPrincipal("test-admin");

const suffix = process.env.TEST_RUN_ID ?? "injection-hostile-spec";
const userId = `user-${suffix}`;
const dealName = `Hostile deal ${suffix}`;
const contactEmail = `hostile-${suffix}@example.test`;

let dealId: string;
let seededStageId: string;
let contactId: string;

function scene(shapeLabel: string, textElementBody: string) {
	return {
		excalidraw: {
			elements: [
				{
					id: "area1",
					type: "rectangle",
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					isDeleted: false,
					customData: { scopeId: "s1", kind: "area", label: shapeLabel },
				},
				{
					id: "t1",
					type: "text",
					x: 0,
					y: 0,
					width: 50,
					height: 20,
					isDeleted: false,
					text: textElementBody,
				},
			],
			appState: {},
			files: {},
		},
		satellite: null,
	};
}

beforeAll(async () => {
	await cleanup();

	await db.user.create({
		data: {
			id: userId,
			name: "Hostile Fixture Tester",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const contact = await db.contact.create({
		data: {
			firstName: "Hostile",
			lastName: "Fixture",
			email: contactEmail,
		},
		select: { id: true },
	});
	contactId = contact.id;

	const seededStage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	seededStageId = seededStage.id;

	const deal = await db.deal.create({
		data: { name: dealName, ownerId: userId, stageId: seededStageId },
		select: { id: true },
	});
	dealId = deal.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.drawing.deleteMany({ where: { title: { contains: suffix } } });
	await db.estimate.deleteMany({ where: { title: { contains: suffix } } });
	await db.deal.deleteMany({ where: { name: { contains: suffix } } });
	await db.contact.deleteMany({ where: { email: contactEmail } });
	await db.user.deleteMany({ where: { id: userId } });
}

describe("read_drawing summary path holds hostile payloads inert", () => {
	for (const { name, text } of HOSTILE_PAYLOADS) {
		it(`fences a ${name} carried in the title, a shape label and drawing text`, async () => {
			const title = `Hostile drawing ${suffix} ${name}: ${text}`;
			const shapeLabel = text.slice(0, 100);

			const drawing = await db.drawing.create({
				data: {
					title,
					scene: scene(shapeLabel, text),
					createdById: userId,
					dealId,
					contactId,
				},
				select: { id: true },
			});

			const summary = await loadDrawingSummary(drawing.id, admin);
			if (!summary.found) throw new Error("expected the drawing to be found");

			assertFenced(summary.title, text);
			assertFenced(summary.shapes[0]?.label ?? "", shapeLabel);
			assertFenced(summary.textElements[0]?.text ?? "", text);
		});
	}
});

describe("read_estimate summary path holds hostile payloads inert", () => {
	for (const { name, text } of HOSTILE_PAYLOADS) {
		it(`fences a ${name} carried in the estimate title and a line item name`, async () => {
			const title = `Hostile estimate ${suffix} ${name}`;

			const estimate = await db.estimate.create({
				data: {
					title: `${title}: ${text}`,
					createdById: userId,
					contactId,
					status: "DRAFT",
					lineItems: {
						create: [
							{
								name: text,
								unit: "PER_EACH",
								quantity: 1,
								priceGoodCents: 100,
								priceBetterCents: 100,
								priceBestCents: 100,
								sortOrder: 0,
							},
						],
					},
				},
				select: { id: true },
			});

			const summary = await loadEstimateSummary(estimate.id, admin);
			if (!summary.found) throw new Error("expected the estimate to be found");

			assertFenced(summary.title, text);
			assertFenced(summary.lineItems[0]?.name ?? "", text);
		});
	}
});

describe("list_drawings summary path holds hostile payloads inert", () => {
	for (const { name, text } of HOSTILE_PAYLOADS) {
		it(`fences a ${name} carried in the drawing title`, async () => {
			const title = `Hostile list drawing ${suffix} ${name}: ${text}`;

			await db.drawing.create({
				data: {
					title,
					scene: scene("harmless label", "harmless note"),
					createdById: userId,
					dealId,
				},
			});

			const result = await listDrawings({ query: title }, admin);
			const row = result.drawings.find((entry) => entry.title.includes(text));
			if (!row) throw new Error("expected the hostile row back");

			assertFenced(row.title, text);
			if (row.dealName) assertFenced(row.dealName, dealName);
		});
	}
});

describe("read_deal_history summary path holds hostile payloads inert", () => {
	for (const { name, text } of HOSTILE_PAYLOADS) {
		it(`fences a ${name} carried in the deal name and description`, async () => {
			const hostileDeal = await db.deal.create({
				data: {
					name: `Hostile crm deal ${suffix} ${name}: ${text}`,
					description: text,
					ownerId: userId,
					stageId: seededStageId,
				},
				select: { id: true },
			});

			const history = await readDealHistory(hostileDeal.id, {}, admin);
			if (!history) throw new Error("expected the deal to be found");

			assertFenced(history.deal.name, text);
			assertFenced(history.deal.description ?? "", text);
		});
	}
});

describe("a sales clerk cannot talk Janus past their group", () => {
	let f: AccessFixture;

	beforeAll(async () => {
		f = await createAccessFixture(`${suffix}-clerk`);
	});

	afterAll(async () => {
		await f.cleanup();
	});

	function clerkCtx() {
		return {
			callId: "hostile-clerk",
			session: {
				auth: {
					current: {
						authenticator: "crm-app",
						principalId: f.clerkId,
						principalType: "user",
						attributes: {},
					},
					initiator: null,
				},
			},
		};
	}

	function noPrices(p: AccessPrincipal): AccessPrincipal {
		return { ...p, policy: { ...p.policy, money: [] } };
	}

	async function execute(tool: { execute?: unknown }, input: unknown) {
		const run = tool.execute as (i: unknown, c: unknown) => Promise<unknown>;
		return run(input, clerkCtx());
	}

	it(`"${LIST_EVERY_DEAL}" through list_deals returns only the clerk's deals`, async () => {
		const result = JSON.stringify(
			await execute(listDealsTool, { status: "all", limit: 100 }),
		);
		expect(result).toContain(f.clerkDealId);
		expect(result).not.toContain(f.otherDealId);
	});

	it(`"${LIST_EVERY_DEAL}" returns no amounts when prices are off`, async () => {
		await db.deal.updateMany({
			where: { id: { in: [f.clerkDealId, f.otherDealId] } },
			data: { amount: 98_765 },
		});
		const listed = await listDeals(
			{ status: "all", limit: 100 },
			noPrices(f.clerk),
		);
		const searched = await searchCrm(
			`${suffix}-clerk`,
			{ limit: 25 },
			noPrices(f.clerk),
		);
		const hostile = await searchCrm(
			LIST_EVERY_DEAL,
			{ limit: 25 },
			noPrices(f.clerk),
		);
		const all = JSON.stringify({ listed, searched, hostile });
		expect(all).not.toContain(f.otherDealId);
		expect(listed.deals.every((deal) => deal.amount === null)).toBe(true);
		expect(searched.deals.every((deal) => deal.amount === null)).toBe(true);
		expect(all).not.toContain("98765");
	});

	it("search_crm with the hostile request leaves out other reps' records", async () => {
		const result = JSON.stringify(
			await execute(searchCrmTool, { query: `${suffix}-clerk`, limit: 25 }),
		);
		expect(result).not.toContain(f.otherDealId);
		expect(result).not.toContain(f.otherContactId);
	});

	it("read estimate <otherEstimateId> is not found for the clerk", async () => {
		const message = readOtherEstimate(f.otherEstimateId);
		const estimateId = message.split(" ")[2]?.replace(/\.$/, "");
		expect(estimateId).toBe(f.otherEstimateId);
		const result = await execute(readEstimateTool, { estimateId });
		expect(result).toEqual({ found: false, reason: "No such estimate." });
	});
});
