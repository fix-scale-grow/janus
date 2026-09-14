import { describe, expect, it } from "bun:test";
import { inflateSync } from "node:zlib";
import { PERMIT_DISCLAIMER } from "@crm/db/permits";
import { renderPermitWorksheetPdf } from "../src/permits/permit-pdf";

function fixture() {
	return {
		workspaceName: "Acme Roofing",
		accentColor: "#006B4F",
		permitTypeLabel: "Roofing permit",
		jurisdictionName: "Permit City",
		jurisdictionState: "CO",
		dealName: "Smith residence re-roof",
		dealNumber: 42,
		permitNumber: "RF-2026-001",
		feeCents: 15000,
		currency: "USD",
		fields: [
			{ label: "Job name", value: "Smith re-roof" },
			{ label: "Owner email", value: "" },
		],
		checklist: [
			{ label: "Site plan", attached: true },
			{ label: "Elevations", attached: false },
		],
		inspections: [
			{
				name: "Final inspection",
				scheduledFor: new Date("2026-02-01"),
				result: "PENDING",
			},
		],
	};
}

function decodeHexRun(segment: string): string {
	const tokens = segment.match(/<([0-9a-fA-F]+)>/g) ?? [];
	return tokens
		.map((token) => {
			const hex = token.slice(1, -1);
			let out = "";
			for (let index = 0; index < hex.length; index += 2) {
				out += String.fromCharCode(
					Number.parseInt(hex.slice(index, index + 2), 16),
				);
			}
			return out;
		})
		.join("");
}

function extractText(buffer: Buffer): string {
	const lines: string[] = [];
	let cursor = 0;

	while (true) {
		const start = buffer.indexOf("stream", cursor);
		if (start === -1) break;
		let dataStart = start + "stream".length;
		if (buffer[dataStart] === 0x0d) dataStart += 1;
		if (buffer[dataStart] === 0x0a) dataStart += 1;
		const end = buffer.indexOf("endstream", dataStart);
		if (end === -1) break;
		cursor = end + "endstream".length;

		try {
			const inflated = inflateSync(buffer.subarray(dataStart, end));
			const content = inflated.toString("latin1");
			const arrays = content.match(/\[[^\]]*\]\s*TJ/g) ?? [];
			for (const array of arrays) lines.push(decodeHexRun(array));
		} catch {}
	}

	return lines.join(" ");
}

describe("renderPermitWorksheetPdf", () => {
	it("returns a non-empty buffer starting with the PDF signature", async () => {
		const buffer = await renderPermitWorksheetPdf(fixture());

		expect(buffer.length).toBeGreaterThan(0);
		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});

	it("includes the verbatim disclaimer text", async () => {
		const buffer = await renderPermitWorksheetPdf(fixture());
		const text = extractText(buffer);

		expect(text).toContain(PERMIT_DISCLAIMER);
	});

	it("includes field values, deal identity and checklist status", async () => {
		const buffer = await renderPermitWorksheetPdf(fixture());
		const text = extractText(buffer);

		expect(text).toContain("Smith re-roof");
		expect(text).toContain("Job name");
		expect(text).toContain("Smith residence re-roof");
		expect(text).toContain("Site plan");
		expect(text).toContain("Attached");
		expect(text).toContain("Missing");
	});

	it("renders with no inspections", async () => {
		const estimate = { ...fixture(), inspections: [] };
		const buffer = await renderPermitWorksheetPdf(estimate);

		expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
	});
});
