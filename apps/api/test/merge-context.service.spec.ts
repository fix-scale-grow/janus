import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { MergeContextService } from "../src/templates/merge-context.service";

function fakeDb(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		organization: {
			findUnique: async () => ({ name: "Acme Roofing" }),
		},
		contact: {
			findUnique: async () => ({
				firstName: "Jane",
				lastName: "Doe",
				email: "jane@example.com",
			}),
		},
		deal: {
			findUnique: async () => ({
				name: "New roof",
				drawings: [{ address: "123 Main St" }],
			}),
		},
		estimate: {
			findUnique: async () => ({
				title: "Roof estimate",
				currency: "USD",
				selectedTier: "BETTER",
				lineItems: [
					{
						quantity: "2",
						priceGoodCents: 10000,
						priceBetterCents: 12000,
						priceBestCents: 15000,
					},
				],
			}),
		},
		invoice: {
			findUnique: async () => ({
				number: 1042,
				currency: "USD",
				dueAt: new Date("2026-09-20T00:00:00Z"),
				lineItems: [
					{ quantity: "3", priceCents: 5000 },
					{ quantity: "1", priceCents: 2000 },
				],
			}),
		},
		contract: {
			findUnique: async () => ({ number: 204, title: "Roofing agreement" }),
		},
		...overrides,
	} as unknown as Db;
}

describe("MergeContextService.resolve", () => {
	it("always resolves business.name from the workspace", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({});

		expect(context["business.name"]).toBe("Acme Roofing");
	});

	it("resolves business.phone to an empty string", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({});

		expect(context["business.phone"]).toBe("");
	});

	it("maps senderName, signingLink and personalNote straight through", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({
			senderName: "Alex Rivera",
			signingLink: "https://app.example.com/sign/abc",
			personalNote: "See you Tuesday!",
		});

		expect(context["sender.name"]).toBe("Alex Rivera");
		expect(context.signing_link).toBe("https://app.example.com/sign/abc");
		expect(context.personal_note).toBe("See you Tuesday!");
	});

	it("resolves contact tokens when a contactId is given", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({ contactId: "c1" });

		expect(context["contact.full_name"]).toBe("Jane Doe");
		expect(context["contact.first_name"]).toBe("Jane");
		expect(context["contact.email"]).toBe("jane@example.com");
	});

	it("resolves deal tokens when a dealId is given", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({ dealId: "d1" });

		expect(context["deal.title"]).toBe("New roof");
		expect(context["deal.address"]).toBe("123 Main St");
	});

	it("resolves estimate.total as the selected-tier line item sum", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({ estimateId: "e1" });

		expect(context["estimate.title"]).toBe("Roof estimate");
		expect(context["estimate.total"]).toBe("$240.00");
		expect(context["estimate.tier"]).toBe("Better");
	});

	it("resolves invoice.total as the line item sum", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({ invoiceId: "i1" });

		expect(context["invoice.number"]).toBe("1042");
		expect(context["invoice.total"]).toBe("$170.00");
		expect(context["invoice.due_date"]).toBe("Sep 20, 2026");
	});

	it("resolves contract tokens when a contractId is given", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({ contractId: "k1" });

		expect(context["contract.number"]).toBe("204");
		expect(context["contract.title"]).toBe("Roofing agreement");
	});

	it("contributes nothing for a ref that is missing", async () => {
		const service = new MergeContextService(fakeDb());
		const context = await service.resolve({});

		expect(context["contact.full_name"]).toBeUndefined();
		expect(context["deal.title"]).toBeUndefined();
		expect(context["estimate.total"]).toBeUndefined();
		expect(context["invoice.total"]).toBeUndefined();
		expect(context["contract.number"]).toBeUndefined();
	});

	it("contributes nothing for a ref id that does not resolve to a row", async () => {
		const service = new MergeContextService(
			fakeDb({ contact: { findUnique: async () => null } }),
		);
		const context = await service.resolve({ contactId: "missing" });

		expect(context["contact.full_name"]).toBeUndefined();
	});
});
