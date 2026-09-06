import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { applyDrawingTags } from "../agent/lib/drawing-writes";

const suffix = process.env.TEST_RUN_ID ?? "drawing-writes-spec";
const userId = `user-${suffix}`;
const title = `Drawing writes fixture ${suffix}`;

let drawingId: string;

type TaggedElement = { id: string; customData: { serviceId?: string } };

function elementsOf(scene: unknown): TaggedElement[] {
	return (scene as { excalidraw: { elements: TaggedElement[] } }).excalidraw
		.elements;
}

function scene() {
	return {
		excalidraw: {
			elements: [
				{
					id: "s1",
					type: "rectangle",
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					isDeleted: false,
					customData: { scopeId: "s1", kind: "area", label: "North slope" },
				},
				{
					id: "s2",
					type: "rectangle",
					x: 0,
					y: 60,
					width: 100,
					height: 50,
					isDeleted: false,
					customData: {
						scopeId: "s2",
						kind: "area",
						label: "South slope",
						serviceId: "svc-existing",
					},
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
			name: "Drawing Writes Tester",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const drawing = await db.drawing.create({
		data: {
			title,
			scene: scene(),
			createdById: userId,
		},
		select: { id: true },
	});
	drawingId = drawing.id;
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.drawing.deleteMany({ where: { title } });
	await db.user.deleteMany({ where: { id: userId } });
}

describe("applyDrawingTags", () => {
	it("applies to the matching scopeId, leaves others byte-identical, and writes a version", async () => {
		const before = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { scene: true },
		});
		const beforeElements = elementsOf(before.scene);

		const result = await applyDrawingTags(drawingId, [
			{ scopeId: "s1", serviceId: "svc-tearoff" },
			{ scopeId: "ghost", serviceId: "svc-gutters" },
		]);

		expect(result).toEqual({
			applied: true,
			drawingId,
			matched: ["s1"],
			unmatched: ["ghost"],
		});

		const after = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { scene: true },
		});
		const elements = elementsOf(after.scene);

		const tagged = elements.find((element) => element.id === "s1");
		const untouched = elements.find((element) => element.id === "s2");

		expect(tagged?.customData.serviceId).toBe("svc-tearoff");
		expect(JSON.stringify(untouched)).toBe(JSON.stringify(beforeElements[1]));

		const versions = await db.drawingVersion.findMany({
			where: { drawingId },
			orderBy: { createdAt: "desc" },
		});
		expect(versions.length).toBeGreaterThan(0);
		const latestElements = elementsOf(versions[0]?.scene);
		expect(
			latestElements.find((element) => element.id === "s1")?.customData
				.serviceId,
		).toBe("svc-tearoff");
	});

	it("reports failure when no tag matches a shape on the drawing", async () => {
		const result = await applyDrawingTags(drawingId, [
			{ scopeId: "nowhere", serviceId: "svc-gutters" },
		]);

		expect(result).toEqual({
			applied: false,
			reason: "None of the proposed tags matched a shape on this drawing.",
		});
	});

	it("reports failure for a drawing that does not exist", async () => {
		const result = await applyDrawingTags("no-such-drawing", [
			{ scopeId: "s1", serviceId: "svc-tearoff" },
		]);

		expect(result).toEqual({ applied: false, reason: "No such drawing." });
	});

	it("bumps sceneUpdatedAt, since it changed the scene", async () => {
		const before = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { sceneUpdatedAt: true },
		});

		await applyDrawingTags(drawingId, [
			{ scopeId: "s2", serviceId: "svc-gutters" },
		]);

		const after = await db.drawing.findUniqueOrThrow({
			where: { id: drawingId },
			select: { sceneUpdatedAt: true },
		});

		expect(after.sceneUpdatedAt).not.toBeNull();
		expect((after.sceneUpdatedAt as Date).getTime()).toBeGreaterThanOrEqual(
			before.sceneUpdatedAt?.getTime() ?? 0,
		);
	});
});
