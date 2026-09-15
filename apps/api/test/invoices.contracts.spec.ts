import { describe, expect, it } from "bun:test";
import { invoiceUpdateInput } from "../src/invoices/invoices.contracts";

function parseDates(dueAt: string, issuedAt: string) {
	const result = invoiceUpdateInput.parse({
		id: "invoice_1",
		data: { dueAt, issuedAt },
	});
	return result.data;
}

describe("invoiceUpdateInput", () => {
	it("stores an issue day and a due day at UTC midnight", () => {
		const data = parseDates(
			"2026-09-20T00:00:00.000Z",
			"2026-09-15T00:00:00.000Z",
		);

		expect(data.dueAt?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
		expect(data.issuedAt?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
	});

	it("drops the time a client sends with a day", () => {
		const data = parseDates(
			"2026-09-20T18:30:00.000Z",
			"2026-09-15T18:30:00.000Z",
		);

		expect(data.dueAt?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
		expect(data.issuedAt?.toISOString()).toBe("2026-09-15T00:00:00.000Z");
	});

	it("keeps null for a cleared day", () => {
		const result = invoiceUpdateInput.parse({
			id: "invoice_1",
			data: { dueAt: null },
		});

		expect(result.data.dueAt).toBeNull();
	});
});
