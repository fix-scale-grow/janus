import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { SearchService } from "../src/search/search.service";

const suffix = process.env.TEST_RUN_ID ?? "search-spec";
const prefix = `search_${suffix}`;
const domain = `${prefix}.test`;

const search = new SearchService(db);

let ownerId: string;
let stageId: string;

let companyContactId: string;
let secondContactId: string;
let dealNumberedId: string;
let dealNumberedNumber: number;
let dealNamedWithNumberId: string;
let invoiceId: string;
let invoiceNumber: number;
let drawingId: string;
let estimateId: string;
let fieldDefId: string;
let fieldDealId: string;
let dedupeDealId: string;
let dedupeFieldDefId: string;

async function clean() {
	await db.fieldValue.deleteMany({
		where: { deal: { name: { startsWith: prefix } } },
	});
	await db.fieldDefinition.deleteMany({
		where: { key: { startsWith: prefix } },
	});
	await db.drawing.deleteMany({ where: { title: { startsWith: prefix } } });
	await db.estimate.deleteMany({ where: { title: { startsWith: prefix } } });
	await db.invoice.deleteMany({
		where: { createdBy: { email: { endsWith: domain } } },
	});
	await db.deal.deleteMany({ where: { name: { startsWith: prefix } } });
	await db.contact.deleteMany({ where: { email: { endsWith: domain } } });
	await db.user.deleteMany({ where: { email: { endsWith: domain } } });
}

beforeAll(async () => {
	await clean();

	const owner = await db.user.create({
		data: {
			id: `${prefix}-owner`,
			name: "Search Owner",
			email: `owner@${domain}`,
		},
		select: { id: true },
	});
	ownerId = owner.id;

	const stage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	stageId = stage.id;

	const contact = await db.contact.create({
		data: {
			firstName: "Rory",
			lastName: "Fenwick",
			email: `rory-${suffix}@${domain}`,
			companyName: `${prefix} Roofing Co`,
		},
		select: { id: true },
	});
	companyContactId = contact.id;

	const secondContact = await db.contact.create({
		data: {
			firstName: "Priya",
			lastName: "Okafor",
			email: `priya-${suffix}@${domain}`,
		},
		select: { id: true },
	});
	secondContactId = secondContact.id;

	const dealNumbered = await db.deal.create({
		data: {
			name: `${prefix} Numbered Deal`,
			ownerId,
			stageId,
			currency: "USD",
		},
		select: { id: true, number: true },
	});
	dealNumberedId = dealNumbered.id;
	dealNumberedNumber = dealNumbered.number;

	const dealNamedWithNumber = await db.deal.create({
		data: {
			name: `${dealNumberedNumber} Wallaby Lane`,
			ownerId,
			stageId,
			currency: "USD",
		},
		select: { id: true },
	});
	dealNamedWithNumberId = dealNamedWithNumber.id;

	const maxInvoice = await db.invoice.aggregate({ _max: { number: true } });
	const invoiceNumberStart = (maxInvoice._max.number ?? 0) + 1000;

	const invoice = await db.invoice.create({
		data: {
			createdById: ownerId,
			currency: "USD",
			number: invoiceNumberStart,
		},
		select: { id: true, number: true },
	});
	invoiceId = invoice.id;
	invoiceNumber = invoice.number;

	const drawing = await db.drawing.create({
		data: {
			title: `${prefix} Site Sketch`,
			scene: {},
			address: `${prefix} 42 Testable Ave`,
			createdById: ownerId,
		},
		select: { id: true },
	});
	drawingId = drawing.id;

	const estimate = await db.estimate.create({
		data: {
			title: `${prefix} Roof Replacement Estimate`,
			status: "SENT",
			currency: "USD",
			createdById: ownerId,
		},
		select: { id: true },
	});
	estimateId = estimate.id;

	const fieldDeal = await db.deal.create({
		data: {
			name: `${prefix} Field Match Deal`,
			ownerId,
			stageId,
			currency: "USD",
		},
		select: { id: true },
	});
	fieldDealId = fieldDeal.id;

	const fieldDef = await db.fieldDefinition.create({
		data: {
			entity: "DEAL",
			key: `${prefix}_permit_no`,
			label: "Permit number",
			type: "TEXT",
			position: 950,
		},
		select: { id: true },
	});
	fieldDefId = fieldDef.id;

	await db.fieldValue.create({
		data: {
			fieldId: fieldDefId,
			dealId: fieldDealId,
			text: `${prefix} PERMIT-9981`,
		},
	});

	const dedupeDeal = await db.deal.create({
		data: {
			name: `${prefix} Dedupe Alpha`,
			ownerId,
			stageId,
			currency: "USD",
		},
		select: { id: true },
	});
	dedupeDealId = dedupeDeal.id;

	const dedupeFieldDef = await db.fieldDefinition.create({
		data: {
			entity: "DEAL",
			key: `${prefix}_dedupe_note`,
			label: "Note",
			type: "TEXT",
			position: 951,
		},
		select: { id: true },
	});
	dedupeFieldDefId = dedupeFieldDef.id;

	await db.fieldValue.create({
		data: {
			fieldId: dedupeFieldDefId,
			dealId: dedupeDealId,
			text: `${prefix} Dedupe Alpha context note`,
		},
	});
});

afterAll(async () => {
	await db.fieldValue.deleteMany({
		where: { fieldId: { in: [fieldDefId, dedupeFieldDefId] } },
	});
	await db.fieldDefinition.deleteMany({
		where: { id: { in: [fieldDefId, dedupeFieldDefId] } },
	});
	await db.drawing.deleteMany({ where: { id: drawingId } });
	await db.estimate.deleteMany({ where: { id: estimateId } });
	await db.invoice.deleteMany({ where: { id: invoiceId } });
	await db.deal.deleteMany({
		where: {
			id: {
				in: [dealNumberedId, dealNamedWithNumberId, fieldDealId, dedupeDealId],
			},
		},
	});
	await db.contact.deleteMany({
		where: { id: { in: [companyContactId, secondContactId] } },
	});
	await db.user.deleteMany({ where: { id: ownerId } });
});

describe("SearchService.quick", () => {
	it("returns nothing below the minimum length", async () => {
		const result = await search.quick("a");
		expect(result.hits).toEqual([]);
	});

	it("finds a contact by company name", async () => {
		const result = await search.quick(`${prefix} Roofing`);
		const hit = result.hits.find((row) => row.id === companyContactId);
		expect(hit).toBeDefined();
		expect(hit?.kind).toBe("contact");
		expect(hit?.label).toBe("Rory Fenwick");
	});

	it("finds a contact by a full first-and-last-name query", async () => {
		const result = await search.quick("Rory Fenwick");
		const hit = result.hits.find((row) => row.id === companyContactId);
		expect(hit).toBeDefined();
		expect(hit?.kind).toBe("contact");
	});

	it("does not cross-match tokens from two different contacts", async () => {
		const result = await search.quick("Rory Okafor");
		const matches = result.hits.filter(
			(row) => row.id === companyContactId || row.id === secondContactId,
		);
		expect(matches).toEqual([]);
	});

	it("finds a deal by name", async () => {
		const result = await search.quick(`${prefix} Numbered Deal`);
		const hit = result.hits.find((row) => row.id === dealNumberedId);
		expect(hit).toBeDefined();
		expect(hit?.kind).toBe("deal");
	});

	it("ranks an exact deal-number hit before a name-contains hit on the digit query", async () => {
		const result = await search.quick(String(dealNumberedNumber));
		const dealHits = result.hits.filter((row) => row.kind === "deal");
		const numberedIndex = dealHits.findIndex(
			(row) => row.id === dealNumberedId,
		);
		const namedIndex = dealHits.findIndex(
			(row) => row.id === dealNamedWithNumberId,
		);

		expect(numberedIndex).toBeGreaterThanOrEqual(0);
		expect(namedIndex).toBeGreaterThanOrEqual(0);
		expect(numberedIndex).toBeLessThan(namedIndex);
	});

	it("finds an invoice by number", async () => {
		const result = await search.quick(String(invoiceNumber));
		const hit = result.hits.find(
			(row) => row.kind === "invoice" && row.id === invoiceId,
		);
		expect(hit).toBeDefined();
		expect(hit?.label).toBe(`#${invoiceNumber}`);
	});

	it("finds a drawing by an address fragment", async () => {
		const result = await search.quick("Testable Ave");
		const hit = result.hits.find((row) => row.id === drawingId);
		expect(hit).toBeDefined();
		expect(hit?.kind).toBe("drawing");
		expect(hit?.detail).toContain("Testable Ave");
	});

	it("finds an estimate by title", async () => {
		const result = await search.quick(`${prefix} Roof Replacement`);
		const hit = result.hits.find(
			(row) => row.kind === "estimate" && row.id === estimateId,
		);
		expect(hit).toBeDefined();
		expect(hit?.label).toBe(`${prefix} Roof Replacement Estimate`);
		expect(hit?.detail).toBe("Sent");
	});

	it("surfaces a TEXT field value hit as its parent deal", async () => {
		const result = await search.quick("PERMIT-9981");
		const hit = result.hits.find(
			(row) => row.kind === "deal" && row.id === fieldDealId,
		);
		expect(hit).toBeDefined();
		expect(hit?.detail).toBe(`Permit number: ${prefix} PERMIT-9981`);
	});

	it("dedupes a deal matched both by name and by a field value", async () => {
		const result = await search.quick(`${prefix} Dedupe Alpha`);
		const matches = result.hits.filter((row) => row.id === dedupeDealId);
		expect(matches.length).toBe(1);
	});
});
