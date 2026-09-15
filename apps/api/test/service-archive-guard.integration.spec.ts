import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { BadRequestException } from "@nestjs/common";
import { EstimatesService } from "../src/estimates/estimates.service";
import { invoiceAddLineItemInput } from "../src/invoices/invoices.contracts";
import { InvoicesService } from "../src/invoices/invoices.service";

const suffix = process.env.TEST_RUN_ID ?? "service-archive-guard-spec";

const estimates = new EstimatesService(
	db,
	{} as never,
	{} as never,
	{} as never,
	{} as never,
	{} as never,
	{} as never,
);
const invoices = new InvoicesService(
	db,
	{} as never,
	{} as never,
	{} as never,
	{} as never,
	{} as never,
);

let f: AccessFixture;
let archivedServiceId: string;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
	const service = await db.service.create({
		data: {
			name: `Archived service ${suffix}`,
			unit: "PER_SQUARE",
			unitPriceCents: 1000,
			active: false,
		},
		select: { id: true },
	});
	archivedServiceId = service.id;
});

afterAll(async () => {
	await db.service.delete({ where: { id: archivedServiceId } });
	await f.cleanup();
});

async function expectArchivedServiceRefused(run: () => Promise<unknown>) {
	let thrown: unknown;
	try {
		await run();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(BadRequestException);
	expect((thrown as BadRequestException).message).toBe(
		"That service is archived. Pick an active one.",
	);
}

describe("archived services cannot be added by id", () => {
	it("estimates addLineItem refuses an archived serviceId", async () => {
		await expectArchivedServiceRefused(() =>
			estimates.addLineItem(
				{
					estimateId: f.clerkEstimateId,
					serviceId: archivedServiceId,
					quantity: 1,
				},
				f.admin,
			),
		);
	});

	it("invoices addLineItem refuses an archived serviceId", async () => {
		await expectArchivedServiceRefused(() =>
			invoices.addLineItem(
				invoiceAddLineItemInput.parse({
					invoiceId: f.clerkInvoiceId,
					serviceId: archivedServiceId,
					name: "Archived",
					unit: "PER_EACH",
					quantity: 1,
				}),
				f.admin,
			),
		);
	});
});
