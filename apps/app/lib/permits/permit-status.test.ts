import { describe, expect, it } from "bun:test";
import {
	canTransitionPermit,
	PERMIT_STATUSES,
	permitTransitions,
} from "./permit-status";

describe("permitTransitions", () => {
	it("only allows DRAFT to move to READY_TO_SUBMIT", () => {
		expect(permitTransitions("DRAFT")).toEqual(["READY_TO_SUBMIT"]);
	});

	it("allows READY_TO_SUBMIT to move back to DRAFT or forward to SUBMITTED", () => {
		expect(permitTransitions("READY_TO_SUBMIT")).toEqual([
			"DRAFT",
			"SUBMITTED",
		]);
	});

	it("allows SUBMITTED to move to ISSUED or DENIED", () => {
		expect(permitTransitions("SUBMITTED")).toEqual(["ISSUED", "DENIED"]);
	});

	it("allows ISSUED to move to INSPECTIONS, CLOSED or EXPIRED", () => {
		expect(permitTransitions("ISSUED")).toEqual([
			"INSPECTIONS",
			"CLOSED",
			"EXPIRED",
		]);
	});

	it("allows DENIED to move back to DRAFT only", () => {
		expect(permitTransitions("DENIED")).toEqual(["DRAFT"]);
	});

	it("allows EXPIRED to move back to DRAFT only", () => {
		expect(permitTransitions("EXPIRED")).toEqual(["DRAFT"]);
	});

	it("treats CLOSED as terminal", () => {
		expect(permitTransitions("CLOSED")).toEqual([]);
	});

	it("has an entry for every permit status", () => {
		for (const status of PERMIT_STATUSES) {
			expect(permitTransitions(status)).toBeDefined();
		}
	});
});

describe("canTransitionPermit", () => {
	it("allows a listed transition", () => {
		expect(canTransitionPermit("DRAFT", "READY_TO_SUBMIT")).toBe(true);
	});

	it("rejects a transition that skips states", () => {
		expect(canTransitionPermit("DRAFT", "SUBMITTED")).toBe(false);
	});

	it("rejects any transition out of CLOSED", () => {
		expect(canTransitionPermit("CLOSED", "DRAFT")).toBe(false);
	});
});
