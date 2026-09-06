import { describe, expect, it } from "bun:test";
import { approvalCopyFor } from "./agent-approval-copy";

describe("generic approval copy fallback", () => {
	it("titles the card from the tool name", () => {
		const copy = approvalCopyFor("refund_charge");
		expect(copy.title).toBe("Approve Refund charge");
	});

	it("flattens a flat input into label/value rows", () => {
		const copy = approvalCopyFor("refund_charge");
		const sections = copy.render({ chargeId: "ch_1", amount: 42 });
		expect(sections).toEqual([
			{
				rows: [
					{ label: "Charge id", value: "ch_1" },
					{ label: "Amount", value: "42" },
				],
			},
		]);
	});

	it("flattens nested objects and arrays without ever emitting raw JSON", () => {
		const copy = approvalCopyFor("build_form");
		const sections = copy.render({
			fields: [
				{ name: "Email", type: "email" },
				{ name: "Phone", type: "tel" },
			],
			tags: ["vip", "referral"],
		});

		const rendered = JSON.stringify(sections);
		expect(rendered).not.toContain("{\\");
		expect(sections[0]?.rows).toEqual([
			{ label: "Fields 1 — Name", value: "Email" },
			{ label: "Fields 1 — Type", value: "email" },
			{ label: "Fields 2 — Name", value: "Phone" },
			{ label: "Fields 2 — Type", value: "tel" },
			{ label: "Tags", value: "vip, referral" },
		]);
	});

	it("returns an empty row set for null input", () => {
		const copy = approvalCopyFor("refund_charge");
		expect(copy.render(null)).toEqual([{ rows: [] }]);
	});
});

describe("generic approval copy fallback bounds", () => {
	it("stops descending past the depth cap and renders a safe summary", () => {
		const copy = approvalCopyFor("refund_charge");
		const sections = copy.render({
			a: { b: { c: { d: { e: { f: "leaf" } } } } },
		});

		expect(sections[0]?.rows).toEqual([
			{ label: "A — B — C — D", value: "{1 fields}" },
		]);
	});

	it("caps a large array at maxRows and appends a truncation marker", () => {
		const copy = approvalCopyFor("refund_charge");
		const items = Array.from({ length: 1000 }, (_, id) => ({ id }));
		const sections = copy.render({ items });
		const rows = sections[0]?.rows ?? [];

		expect(rows).toHaveLength(40);
		expect(rows[0]).toEqual({ label: "Items 1 — Id", value: "0" });
		expect(rows.at(-1)).toEqual({
			label: "…",
			value: "961 more not shown",
		});
	});

	it("truncates a huge string value with an ellipsis", () => {
		const copy = approvalCopyFor("refund_charge");
		const huge = "x".repeat(600);
		const sections = copy.render({ notes: huge });
		const row = sections[0]?.rows[0];

		expect(row?.label).toBe("Notes");
		expect(row?.value).toHaveLength(501);
		expect(row?.value.endsWith("…")).toBe(true);
		expect(row?.value.startsWith("x".repeat(500))).toBe(true);
	});

	it("renders a Date as a sane string instead of walking its fields", () => {
		const copy = approvalCopyFor("refund_charge");
		const sections = copy.render({
			scheduledFor: new Date("2026-01-01T00:00:00.000Z"),
		});

		expect(sections[0]?.rows).toEqual([
			{ label: "Scheduled for", value: "2026-01-01T00:00:00.000Z" },
		]);
	});
});
