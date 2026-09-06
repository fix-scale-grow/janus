import { afterAll, beforeAll, describe, it } from "bun:test";
import { db } from "@crm/db";
import { listDrawings } from "../agent/lib/drawing-lookup";
import { loadDrawingSummary } from "../agent/lib/drawing-summary";
import { loadEstimateSummary } from "../agent/lib/estimate-summary";
import { assertFenced, HOSTILE_PAYLOADS } from "./injection-fixtures";

const suffix = process.env.TEST_RUN_ID ?? "injection-hostile-spec";
const userId = `user-${suffix}`;
const dealName = `Hostile deal ${suffix}`;
const contactEmail = `hostile-${suffix}@example.test`;

let dealId: string;
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

	const deal = await db.deal.create({
		data: { name: dealName, ownerId: userId },
		select: { id: true },
	});
	dealId = deal.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.drawing.deleteMany({ where: { title: { contains: suffix } } });
	await db.estimate.deleteMany({ where: { title: { contains: suffix } } });
	await db.deal.deleteMany({ where: { name: dealName } });
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

			const summary = await loadDrawingSummary(drawing.id);
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

			const summary = await loadEstimateSummary(estimate.id);
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

			const result = await listDrawings({ query: title });
			const row = result.drawings.find((entry) => entry.title.includes(text));
			if (!row) throw new Error("expected the hostile row back");

			assertFenced(row.title, text);
			if (row.dealName) assertFenced(row.dealName, dealName);
		});
	}
});
