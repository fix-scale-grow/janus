import { describe, expect, it } from "bun:test";
import {
	canTransition,
	PERMIT_DISCLAIMER,
	PERMIT_DISCLAIMER_VERSION,
	parsePlaybookFacts,
	parseWorksheetAnswers,
	parseWorksheetTemplate,
	provenanceFact,
} from "../src/permits";

const fact = {
	value: "Within 5 business days",
	sourceUrl: "https://example.gov/permits",
	verifiedById: "user_1",
	verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("PERMIT_DISCLAIMER", () => {
	it("has a stable version", () => {
		expect(PERMIT_DISCLAIMER_VERSION).toBe(1);
		expect(PERMIT_DISCLAIMER.length).toBeGreaterThan(0);
	});
});

describe("provenanceFact", () => {
	it("round-trips a full fact", () => {
		expect(provenanceFact.parse(fact)).toEqual(fact);
	});

	it("allows a null sourceUrl", () => {
		const nullSourced = { ...fact, sourceUrl: null };
		expect(provenanceFact.parse(nullSourced)).toEqual(nullSourced);
	});

	it("rejects a non-URL sourceUrl naming the path", () => {
		try {
			provenanceFact.parse({ ...fact, sourceUrl: "not-a-url" });
			throw new Error("expected provenanceFact.parse to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain("sourceUrl");
		}
	});
});

describe("parsePlaybookFacts", () => {
	it("round-trips full facts", () => {
		const facts = {
			neededWhen: fact,
			whoMayPull: fact,
			prerequisites: [fact],
			howToApply: fact,
			feeSchedule: fact,
			typicalTurnaround: fact,
			requiredDocuments: [
				{
					key: "site_plan",
					label: "Site plan",
					reusable: true,
					sourceUrl: null,
					lockerKind: null,
					verifiedById: null,
					verifiedAt: null,
				},
			],
			inspections: [
				{
					name: "Framing",
					when: "After framing",
					criticalNote: null,
					verifiedById: null,
					verifiedAt: null,
				},
			],
		};

		expect(parsePlaybookFacts(facts)).toEqual(facts);
	});

	it("defaults every field for an empty object", () => {
		expect(parsePlaybookFacts({})).toEqual({
			neededWhen: null,
			whoMayPull: null,
			prerequisites: [],
			howToApply: null,
			feeSchedule: null,
			typicalTurnaround: null,
			requiredDocuments: [],
			inspections: [],
		});
	});

	it("parses an old-shape stored entry, defaulting the new verification fields to null", () => {
		const old = {
			requiredDocuments: [
				{
					key: "site_plan",
					label: "Site plan",
					reusable: true,
					sourceUrl: null,
				},
			],
			inspections: [{ name: "Framing", when: null, criticalNote: null }],
		};

		const parsed = parsePlaybookFacts(old);
		expect(parsed.requiredDocuments[0]?.lockerKind).toBeNull();
		expect(parsed.requiredDocuments[0]?.verifiedById).toBeNull();
		expect(parsed.requiredDocuments[0]?.verifiedAt).toBeNull();
		expect(parsed.inspections[0]?.verifiedById).toBeNull();
		expect(parsed.inspections[0]?.verifiedAt).toBeNull();
	});

	it("throws an Error naming the first bad path", () => {
		expect(() =>
			parsePlaybookFacts({ neededWhen: { ...fact, sourceUrl: "nope" } }),
		).toThrow(/neededWhen\.sourceUrl/);
	});
});

describe("parseWorksheetTemplate", () => {
	const field = {
		key: "job_address",
		label: "Job address",
		type: "TEXT" as const,
		prefill: "job_address" as const,
		required: true,
	};

	it("round-trips a valid template", () => {
		expect(parseWorksheetTemplate([field])).toEqual([field]);
	});

	it("rejects a key with an uppercase letter or space", () => {
		expect(() =>
			parseWorksheetTemplate([{ ...field, key: "Bad Key" }]),
		).toThrow(/key/);
	});

	it("rejects duplicate keys", () => {
		expect(() => parseWorksheetTemplate([field, field])).toThrow(
			/Duplicate worksheet field key/,
		);
	});
});

describe("parseWorksheetAnswers", () => {
	const answer = {
		value: "123 Main St",
		origin: "HUMAN" as const,
		state: "APPROVED" as const,
		approvedById: "user_1",
		approvedAt: new Date("2026-01-01T00:00:00.000Z"),
	};

	it("round-trips a valid answers map", () => {
		expect(parseWorksheetAnswers({ job_address: answer })).toEqual({
			job_address: answer,
		});
	});

	it("rejects a key with an uppercase letter or space", () => {
		expect(() => parseWorksheetAnswers({ "Bad Key": answer })).toThrow();
	});
});

describe("canTransition", () => {
	it("rejects DRAFT to SUBMITTED", () => {
		expect(canTransition("DRAFT", "SUBMITTED")).toBe(false);
	});

	it("allows SUBMITTED to ISSUED", () => {
		expect(canTransition("SUBMITTED", "ISSUED")).toBe(true);
	});

	it("rejects any transition out of CLOSED", () => {
		expect(canTransition("CLOSED", "DRAFT")).toBe(false);
		expect(canTransition("CLOSED", "ISSUED")).toBe(false);
	});

	it("allows DENIED back to DRAFT", () => {
		expect(canTransition("DENIED", "DRAFT")).toBe(true);
	});
});
