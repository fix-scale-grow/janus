import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DealsService } from "../src/deals/deals.service";
import { DrawingsService } from "../src/drawings/drawings.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "drawings-contact-link-spec";
const userId = `user-${suffix}`;

const agent = {
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;

const deals = new DealsService(
	db,
	agent,
	new ActivityStampService(db),
	new ConversionService(db),
	new FieldsService(db, { fieldBackfill: async () => undefined } as never),
);

const drawings = new DrawingsService(db);

let dealId: string;
let contactId: string;
let drawingId: string;

async function clean() {
	await db.drawing.deleteMany({ where: { title: { contains: suffix } } });
	await db.deal.deleteMany({ where: { name: { contains: suffix } } });
	await db.contact.deleteMany({ where: { email: { contains: suffix } } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();

	await db.user.create({
		data: {
			id: userId,
			name: "Drawing Rep",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const contact = await db.contact.create({
		data: {
			firstName: "Job",
			lastName: "Site",
			email: `contact-${suffix}@example.test`,
		},
		select: { id: true },
	});
	contactId = contact.id;

	const deal = await deals.create({ name: `Roof ${suffix}`, ownerId: userId });
	dealId = deal.id;
	await deals.attachContact({ dealId, contactId });

	const drawing = await db.drawing.create({
		data: {
			title: `Untitled drawing ${suffix}`,
			dealId,
			createdById: userId,
			scene: {},
		},
		select: { id: true },
	});
	drawingId = drawing.id;
});

afterAll(clean);

describe("a contact's Drawings tab", () => {
	it("shows a drawing attached to the deal, not just the contact", async () => {
		const result = await drawings.list({
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 25,
			attachment: "all",
			contactId,
		});

		expect(result.rows.map((row) => row.id)).toContain(drawingId);
	});

	it("does not show a drawing on someone else's deal", async () => {
		const stranger = await db.contact.create({
			data: {
				firstName: "Not",
				lastName: "Involved",
				email: `stranger-${suffix}@example.test`,
			},
			select: { id: true },
		});

		const result = await drawings.list({
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 25,
			attachment: "all",
			contactId: stranger.id,
		});

		expect(result.rows.map((row) => row.id)).not.toContain(drawingId);
	});
});
