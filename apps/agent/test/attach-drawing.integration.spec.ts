import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { attachDrawing } from "../agent/lib/drawing-writes";

const suffix = process.env.TEST_RUN_ID ?? "attach-drawing-spec";
const userId = `user-${suffix}`;
const dealAName = `Attach drawing deal A ${suffix}`;
const dealBName = `Attach drawing deal B ${suffix}`;
const contactEmail = `attach-drawing-${suffix}@example.test`;
const title = `Attach drawing fixture ${suffix}`;

let dealAId: string;
let dealBId: string;
let contactId: string;
let drawingId: string;

beforeAll(async () => {
	await cleanup();

	await db.user.create({
		data: {
			id: userId,
			name: "Attach Drawing Tester",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const [dealA, dealB, contact] = await Promise.all([
		db.deal.create({
			data: { name: dealAName, ownerId: userId },
			select: { id: true },
		}),
		db.deal.create({
			data: { name: dealBName, ownerId: userId },
			select: { id: true },
		}),
		db.contact.create({
			data: { firstName: "Attach", lastName: "Drawing", email: contactEmail },
			select: { id: true },
		}),
	]);
	dealAId = dealA.id;
	dealBId = dealB.id;
	contactId = contact.id;

	const drawing = await db.drawing.create({
		data: {
			title,
			scene: {
				excalidraw: { elements: [], appState: {}, files: {} },
				satellite: null,
			},
			createdById: userId,
			dealId: dealAId,
		},
		select: { id: true },
	});
	drawingId = drawing.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.drawing.deleteMany({ where: { title } });
	await db.deal.deleteMany({ where: { name: { in: [dealAName, dealBName] } } });
	await db.contact.deleteMany({ where: { email: contactEmail } });
	await db.user.deleteMany({ where: { id: userId } });
}

describe("attachDrawing", () => {
	it("refuses to move a drawing to a different deal without confirmReplace, leaving the database unchanged", async () => {
		const result = await attachDrawing({ drawingId, dealId: dealBId });

		expect(result).toEqual({
			attached: false,
			reason: expect.stringContaining("confirmReplace"),
		});

		const drawing = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { dealId: true },
		});
		expect(drawing.dealId).toBe(dealAId);
	});

	it("applies the move once confirmReplace is set", async () => {
		const result = await attachDrawing({
			drawingId,
			dealId: dealBId,
			confirmReplace: true,
		});

		expect(result).toEqual({
			attached: true,
			drawingId,
			dealId: dealBId,
			contactId: null,
		});

		const drawing = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { dealId: true },
		});
		expect(drawing.dealId).toBe(dealBId);
	});

	it("attaches a contact with no confirmation needed when none was set", async () => {
		const result = await attachDrawing({ drawingId, contactId });

		expect(result).toEqual({
			attached: true,
			drawingId,
			dealId: dealBId,
			contactId,
		});
	});

	it("re-setting the same deal needs no confirmation", async () => {
		const result = await attachDrawing({ drawingId, dealId: dealBId });

		expect(result).toEqual({
			attached: true,
			drawingId,
			dealId: dealBId,
			contactId,
		});
	});

	it("refuses to detach an existing contact without confirmReplace, leaving the database unchanged", async () => {
		const result = await attachDrawing({ drawingId, contactId: null });

		expect(result).toEqual({
			attached: false,
			reason: expect.stringContaining("confirmReplace"),
		});

		const drawing = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { contactId: true },
		});
		expect(drawing.contactId).toBe(contactId);
	});

	it("detaches once confirmReplace is set", async () => {
		const result = await attachDrawing({
			drawingId,
			contactId: null,
			confirmReplace: true,
		});

		expect(result).toEqual({
			attached: true,
			drawingId,
			dealId: dealBId,
			contactId: null,
		});
	});

	it("reports failure for a drawing that does not exist", async () => {
		const result = await attachDrawing({
			drawingId: "no-such-drawing",
			dealId: dealAId,
		});

		expect(result).toEqual({ attached: false, reason: "No such drawing." });
	});

	it("reports failure for a deal that does not exist", async () => {
		const result = await attachDrawing({
			drawingId,
			dealId: "no-such-deal",
			confirmReplace: true,
		});

		expect(result).toEqual({ attached: false, reason: "No such deal." });
	});

	it("reports failure for a contact that does not exist", async () => {
		const result = await attachDrawing({
			drawingId,
			contactId: "no-such-contact",
		});

		expect(result).toEqual({ attached: false, reason: "No such contact." });
	});

	it("reports nothing to change when neither field is given", async () => {
		const result = await attachDrawing({ drawingId });

		expect(result).toEqual({
			attached: false,
			reason: "Nothing to change. Pass dealId or contactId.",
		});
	});

	it("leaves sceneUpdatedAt untouched, since attaching is metadata-only", async () => {
		const before = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { sceneUpdatedAt: true },
		});

		await attachDrawing({ drawingId, dealId: dealAId, confirmReplace: true });

		const after = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { sceneUpdatedAt: true },
		});

		expect(after.sceneUpdatedAt).toEqual(before.sceneUpdatedAt);
	});
});
