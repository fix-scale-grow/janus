import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { listDrawings } from "../agent/lib/drawing-lookup";

const suffix = process.env.TEST_RUN_ID ?? "drawing-lookup-spec";
const userId = `user-${suffix}`;
const dealName = `Drawing lookup deal ${suffix}`;
const titlePrefix = `Drawing lookup fixture ${suffix}`;

let dealId: string;
let orphanId: string;
let attachedId: string;
let recentId: string;

function scene() {
	return {
		excalidraw: { elements: [], appState: {}, files: {} },
		satellite: null,
	};
}

beforeAll(async () => {
	await cleanup();

	await db.user.create({
		data: {
			id: userId,
			name: "Drawing Lookup Tester",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const deal = await db.deal.create({
		data: { name: dealName, ownerId: userId },
		select: { id: true },
	});
	dealId = deal.id;

	const orphan = await db.drawing.create({
		data: {
			title: `${titlePrefix} orphan`,
			scene: scene(),
			createdById: userId,
		},
		select: { id: true },
	});
	orphanId = orphan.id;

	const attached = await db.drawing.create({
		data: {
			title: `${titlePrefix} attached`,
			scene: scene(),
			createdById: userId,
			dealId,
		},
		select: { id: true },
	});
	attachedId = attached.id;

	const recent = await db.drawing.create({
		data: {
			title: `${titlePrefix} recent`,
			scene: scene(),
			createdById: userId,
		},
		select: { id: true },
	});
	recentId = recent.id;

	await db.drawing.update({
		where: { id: orphanId },
		data: { updatedAt: new Date(Date.now() - 60_000) },
	});
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.drawing.deleteMany({
		where: { title: { startsWith: titlePrefix } },
	});
	await db.deal.deleteMany({ where: { name: dealName } });
	await db.user.deleteMany({ where: { id: userId } });
}

describe("listDrawings", () => {
	it("orders by most recently updated first", async () => {
		const result = await listDrawings({ query: titlePrefix });
		const ids = result.drawings.map((row) => row.id);

		expect(ids.indexOf(recentId)).toBeLessThan(ids.indexOf(attachedId));
		expect(ids.indexOf(attachedId)).toBeLessThan(ids.indexOf(orphanId));
	});

	it("filters to drawings with no deal or contact", async () => {
		const result = await listDrawings({ query: titlePrefix, attached: "none" });
		const ids = result.drawings.map((row) => row.id);

		expect(ids).toContain(orphanId);
		expect(ids).toContain(recentId);
		expect(ids).not.toContain(attachedId);
	});

	it("filters to drawings attached to a deal, and reports the deal id and name", async () => {
		const result = await listDrawings({ query: titlePrefix, attached: "deal" });
		const row = result.drawings.find((entry) => entry.id === attachedId);

		expect(result.drawings.map((entry) => entry.id)).toEqual([attachedId]);
		expect(row?.dealId).toBe(dealId);
		expect(row?.dealName).toContain(dealName);
	});

	it("filters to drawings attached to a contact", async () => {
		const result = await listDrawings({
			query: titlePrefix,
			attached: "contact",
		});

		expect(result.drawings).toEqual([]);
	});

	it("respects the limit", async () => {
		const result = await listDrawings({ query: titlePrefix, limit: 1 });

		expect(result.drawings).toHaveLength(1);
	});
});
