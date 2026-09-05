import { describe, expect, it } from "bun:test";
import {
	invoiceTotalCents,
	renderInvoicePdf,
} from "../src/invoices/invoice-pdf";

function fixture() {
	return {
		number: 42,
		currency: "USD",
		issuedAt: new Date("2026-01-15T00:00:00Z"),
		dueAt: new Date("2026-02-14T00:00:00Z"),
		notes: "Net 30. Thank you for your business.",
		contact: {
			firstName: "Jane",
			lastName: "Smith",
			email: "jane@example.com",
			phone: "555-0100",
		},
		lineItems: [
			{
				name: "Tear-off",
				unit: "PER_SQUARE",
				quantity: 14.5,
				areaLabel: "Main roof",
				priceCents: 8500,
			},
			{
				name: "Ridge vent",
				unit: "PER_LINEAR_FT",
				quantity: 32,
				areaLabel: "Main roof",
				priceCents: 450,
			},
			{
				name: "Permit",
				unit: "FLAT",
				quantity: 1,
				areaLabel: null,
				priceCents: 20000,
			},
		],
	};
}

describe("renderInvoicePdf", () => {
	it("returns a non-empty buffer starting with the PDF signature", async () => {
		const buffer = await renderInvoicePdf(fixture(), "Acme Roofing");

		expect(buffer.length).toBeGreaterThan(0);
		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("renders without a contact or notes", async () => {
		const invoice = { ...fixture(), contact: null, notes: null };
		const buffer = await renderInvoicePdf(invoice, "Acme Roofing");

		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("computes the total due matching a hand-computed literal", () => {
		const total = invoiceTotalCents(fixture().lineItems);

		expect(total).toBe(157650);
	});
});
