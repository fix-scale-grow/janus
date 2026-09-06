import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { ContactsService } from "../src/contacts/contacts.service";
import { EstimatesService } from "../src/estimates/estimates.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import type { TemplatesService } from "../src/templates/templates.service";

type Element = {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	customData: Record<string, unknown>;
};

function square(scopeId: string, extra: Record<string, unknown>): Element {
	return {
		id: scopeId,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		customData: {
			scopeId,
			kind: "area",
			serviceId: "svc-tearoff",
			label: "Main roof",
			...extra,
		},
	};
}

function scene(elements: Element[]) {
	return { excalidraw: { elements, appState: {}, files: {} }, satellite: null };
}

type LineItemRow = {
	id: string;
	estimateId: string;
	serviceId: string | null;
	name: string;
	unit: string;
	quantity: string;
	priceGoodCents: number;
	priceBetterCents: number;
	priceBestCents: number;
	areaLabel: string | null;
	scopeId: string | null;
	sortOrder: number;
};

const SERVICE = {
	id: "svc-tearoff",
	name: "Tear-off",
	unit: "PER_SQUARE",
	unitPriceCents: 8500,
	priceGoodCents: null,
	priceBestCents: null,
	symbolId: null,
	active: true,
};

function fakeDb(options: {
	elements: Element[];
	lineItems: LineItemRow[];
	drawingUpdatedAt?: Date;
	drawingSyncedAt?: Date | null;
}) {
	const created: Record<string, unknown>[] = [];
	const updated: { id: string; quantity: number }[] = [];
	const syncStamps: (Date | null | undefined)[] = [];

	const db = {
		estimate: {
			findUnique: async (args: {
				include?: unknown;
				where: { id: string };
			}) => ({
				id: args.where.id,
				title: "Roof estimate",
				status: "DRAFT" as const,
				currency: "USD",
				selectedTier: "BETTER" as const,
				dealId: null,
				contactId: null,
				drawingId: "dr1",
				createdById: "user1",
				createdAt: new Date("2026-01-01T00:00:00Z"),
				updatedAt: new Date("2026-01-01T00:00:00Z"),
				drawingSyncedAt: options.drawingSyncedAt ?? null,
				lineItems: options.lineItems,
				contact: null,
				drawing: { updatedAt: options.drawingUpdatedAt ?? new Date(0) },
			}),
			update: async (args: { data: { drawingSyncedAt?: Date } }) => {
				syncStamps.push(args.data.drawingSyncedAt);
				return { id: "est1" };
			},
		},
		drawing: {
			findUnique: async () => ({
				id: "dr1",
				scene: scene(options.elements),
				scale: { pixelsPerFoot: 1, referenceElementId: null },
				updatedAt: options.drawingUpdatedAt ?? new Date(0),
			}),
		},
		service: {
			findMany: async () => [SERVICE],
		},
		symbol: {
			findMany: async () => [],
		},
		estimateLineItem: {
			update: async (args: {
				where: { id: string };
				data: { quantity: number };
			}) => {
				updated.push({ id: args.where.id, quantity: args.data.quantity });
				return { id: args.where.id };
			},
			create: async (args: { data: Record<string, unknown> }) => {
				const row = { id: `new${created.length + 1}`, ...args.data };
				created.push(row);
				return row;
			},
			createMany: async (args: { data: Record<string, unknown>[] }) => {
				for (const row of args.data) created.push(row);
				return { count: args.data.length };
			},
		},
		$transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
	} as unknown as Db;

	return { db, created, updated, syncStamps };
}

function service(db: Db) {
	return new EstimatesService(
		db,
		{} as ContactsService,
		{} as MailerService,
		{} as TemplatesService,
		{} as MergeContextService,
		{} as AgentTriggerService,
	);
}

const PRICED_ITEM: LineItemRow = {
	id: "li1",
	estimateId: "est1",
	serviceId: "svc-tearoff",
	name: "Tear-off",
	unit: "PER_SQUARE",
	quantity: "100",
	priceGoodCents: 8500,
	priceBetterCents: 8500,
	priceBestCents: 8500,
	areaLabel: "Main roof",
	scopeId: "sq1",
	sortOrder: 0,
};

describe("resyncFromDrawing", () => {
	it("applies a pitch added after generation to an existing line item", async () => {
		const { db, updated } = fakeDb({
			elements: [square("sq1", { pitch: "6/12" })],
			lineItems: [PRICED_ITEM],
		});

		const result = await service(db).resyncFromDrawing("est1");

		expect(updated).toHaveLength(1);
		expect(updated[0]?.quantity).toBe(111.8);
		expect(result.changed[0]?.newQuantity).toBe(111.8);
	});

	it("adds a line item for a shape scoped after the estimate was generated", async () => {
		const { db, created } = fakeDb({
			elements: [
				square("sq1", { pitch: "6/12" }),
				square("sq2", { pitch: "6/12", label: "Garage" }),
			],
			lineItems: [PRICED_ITEM],
		});

		const result = await service(db).resyncFromDrawing("est1");

		expect(created).toHaveLength(1);
		expect(created[0]?.scopeId).toBe("sq2");
		expect(created[0]?.quantity).toBe(111.8);
		expect(result.added).toHaveLength(1);
		expect(result.added[0]?.name).toBe("Tear-off");
	});

	it("leaves an unscoped line item alone", async () => {
		const { db, created, updated } = fakeDb({
			elements: [square("sq1", {})],
			lineItems: [
				PRICED_ITEM,
				{ ...PRICED_ITEM, id: "li2", scopeId: null, name: "Dump fee" },
			],
		});

		await service(db).resyncFromDrawing("est1");

		expect(updated).toHaveLength(0);
		expect(created).toHaveLength(0);
	});

	it("stamps the sync time so the estimate stops reading as stale", async () => {
		const { db, syncStamps } = fakeDb({
			elements: [square("sq1", { pitch: "6/12" })],
			lineItems: [PRICED_ITEM],
		});

		await service(db).resyncFromDrawing("est1");

		expect(syncStamps).toHaveLength(1);
		expect(syncStamps[0]).toBeInstanceOf(Date);
	});
});

describe("byId drawing staleness", () => {
	it("reports stale when the drawing changed after the last sync", async () => {
		const { db } = fakeDb({
			elements: [square("sq1", {})],
			lineItems: [PRICED_ITEM],
			drawingUpdatedAt: new Date("2026-02-02T00:00:00Z"),
			drawingSyncedAt: new Date("2026-02-01T00:00:00Z"),
		});

		const row = await service(db).byId("est1");

		expect(row.drawingStale).toBe(true);
	});

	it("reports fresh when the last sync is newer than the drawing", async () => {
		const { db } = fakeDb({
			elements: [square("sq1", {})],
			lineItems: [PRICED_ITEM],
			drawingUpdatedAt: new Date("2026-02-01T00:00:00Z"),
			drawingSyncedAt: new Date("2026-02-02T00:00:00Z"),
		});

		const row = await service(db).byId("est1");

		expect(row.drawingStale).toBe(false);
	});
});
