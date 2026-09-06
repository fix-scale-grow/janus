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
