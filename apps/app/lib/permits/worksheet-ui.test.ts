import { describe, expect, it } from "bun:test";
import {
	deriveWorksheetFieldKey,
	isWorksheetHardBlocked,
	uniqueWorksheetFieldKey,
	worksheetBlockingReason,
} from "./worksheet-ui";

describe("deriveWorksheetFieldKey", () => {
	it("lowercases and underscores a label", () => {
		expect(deriveWorksheetFieldKey("Job Valuation")).toBe("job_valuation");
	});

	it("strips punctuation", () => {
		expect(deriveWorksheetFieldKey("Owner's Email!")).toBe("owner_s_email");
	});

	it("trims leading and trailing underscores", () => {
		expect(deriveWorksheetFieldKey("  -Scope of Work-  ")).toBe(
			"scope_of_work",
		);
	});

	it("falls back to field when nothing survives", () => {
		expect(deriveWorksheetFieldKey("!!!")).toBe("field");
	});

	it("caps the key at 60 characters", () => {
		const long = "a".repeat(80);
		expect(deriveWorksheetFieldKey(long).length).toBe(60);
	});
});

describe("uniqueWorksheetFieldKey", () => {
	it("keeps the derived key when it is free", () => {
		expect(uniqueWorksheetFieldKey("Job Valuation", ["job_number"])).toBe(
			"job_valuation",
		);
	});

	it("appends a counter on collision", () => {
		expect(uniqueWorksheetFieldKey("Job Valuation", ["job_valuation"])).toBe(
			"job_valuation_2",
		);
	});

	it("keeps counting past a taken suffix", () => {
		expect(
			uniqueWorksheetFieldKey("Job Valuation", [
				"job_valuation",
				"job_valuation_2",
			]),
		).toBe("job_valuation_3");
	});
});

describe("worksheetBlockingReason", () => {
	const fields = [
		{ key: "job_valuation", label: "Job valuation", required: true },
		{ key: "scope", label: "Scope of work", required: false },
	];

	it("reports a single field awaiting review", () => {
		const reason = worksheetBlockingReason({
			fields,
			answers: {
				job_valuation: { value: "24000", state: "NEEDS_REVIEW" },
			},
			disclaimerAccepted: true,
		});
		expect(reason).toBe("1 field awaits review.");
	});

	it("pluralizes multiple fields awaiting review", () => {
		const reason = worksheetBlockingReason({
			fields,
			answers: {
				job_valuation: { value: "24000", state: "NEEDS_REVIEW" },
				scope: { value: "Reroof", state: "NEEDS_REVIEW" },
			},
			disclaimerAccepted: true,
		});
		expect(reason).toBe("2 fields await review.");
	});

	it("names the first missing required field", () => {
		const reason = worksheetBlockingReason({
			fields,
			answers: {},
			disclaimerAccepted: true,
		});
		expect(reason).toBe("Job valuation is required.");
	});

	it("asks for the disclaimer once fields are clear", () => {
		const reason = worksheetBlockingReason({
			fields,
			answers: {
				job_valuation: { value: "24000", state: "APPROVED" },
			},
			disclaimerAccepted: false,
		});
		expect(reason).toBe("Accept the preparation disclaimer first.");
	});

	it("returns null once every gate passes", () => {
		const reason = worksheetBlockingReason({
			fields,
			answers: {
				job_valuation: { value: "24000", state: "APPROVED" },
			},
			disclaimerAccepted: true,
		});
		expect(reason).toBeNull();
	});

	it("ignores a NEEDS_REVIEW answer whose key is not on the live template", () => {
		const reason = worksheetBlockingReason({
			fields,
			answers: {
				job_valuation: { value: "24000", state: "APPROVED" },
				removed_field: { value: "old answer", state: "NEEDS_REVIEW" },
			},
			disclaimerAccepted: true,
		});
		expect(reason).toBeNull();
	});
});

describe("isWorksheetHardBlocked", () => {
	const fields = [
		{ key: "job_valuation", label: "Job valuation", required: true },
	];

	it("blocks on a pending review", () => {
		expect(
			isWorksheetHardBlocked({
				fields,
				answers: { job_valuation: { value: "24000", state: "NEEDS_REVIEW" } },
			}),
		).toBe(true);
	});

	it("blocks on a missing required field", () => {
		expect(isWorksheetHardBlocked({ fields, answers: {} })).toBe(true);
	});

	it("does not block on a missing disclaimer alone", () => {
		expect(
			isWorksheetHardBlocked({
				fields,
				answers: { job_valuation: { value: "24000", state: "APPROVED" } },
			}),
		).toBe(false);
	});

	it("does not block on a NEEDS_REVIEW answer whose key is not on the live template", () => {
		expect(
			isWorksheetHardBlocked({
				fields,
				answers: {
					job_valuation: { value: "24000", state: "APPROVED" },
					removed_field: { value: "old answer", state: "NEEDS_REVIEW" },
				},
			}),
		).toBe(false);
	});
});
