import { describe, expect, it } from "bun:test";
import { StageOutcome } from "@crm/db/enums";
import {
	entryStageOf,
	isClosedStage,
	isWonStage,
	requiresReason,
	STAGE_SWATCHES,
} from "@crm/db/stage-semantics";

const stage = (outcome: StageOutcome) => ({ outcome });

describe("outcome math", () => {
	it("treats OPEN as not closed", () => {
		expect(isClosedStage(stage(StageOutcome.OPEN))).toBe(false);
	});

	it("treats WON, LOST, and DISQUALIFIED as closed", () => {
		expect(isClosedStage(stage(StageOutcome.WON))).toBe(true);
		expect(isClosedStage(stage(StageOutcome.LOST))).toBe(true);
		expect(isClosedStage(stage(StageOutcome.DISQUALIFIED))).toBe(true);
	});

	it("requires a reason only for LOST and DISQUALIFIED", () => {
		expect(requiresReason(stage(StageOutcome.OPEN))).toBe(false);
		expect(requiresReason(stage(StageOutcome.WON))).toBe(false);
		expect(requiresReason(stage(StageOutcome.LOST))).toBe(true);
		expect(requiresReason(stage(StageOutcome.DISQUALIFIED))).toBe(true);
	});

	it("counts only WON as a win", () => {
		expect(isWonStage(stage(StageOutcome.WON))).toBe(true);
		expect(isWonStage(stage(StageOutcome.OPEN))).toBe(false);
		expect(isWonStage(stage(StageOutcome.LOST))).toBe(false);
		expect(isWonStage(stage(StageOutcome.DISQUALIFIED))).toBe(false);
	});
});

describe("entry resolution", () => {
	it("picks the non-archived entry stage", () => {
		const stages = [
			{ outcome: StageOutcome.OPEN, isEntry: false, archivedAt: null },
			{ outcome: StageOutcome.OPEN, isEntry: true, archivedAt: null },
			{ outcome: StageOutcome.WON, isEntry: false, archivedAt: null },
		];

		expect(entryStageOf(stages)).toBe(stages[1]);
	});

	it("skips an archived entry stage", () => {
		const stages = [
			{ outcome: StageOutcome.OPEN, isEntry: true, archivedAt: new Date() },
			{ outcome: StageOutcome.OPEN, isEntry: false, archivedAt: null },
		];

		expect(entryStageOf(stages)).toBeUndefined();
	});

	it("returns undefined when nothing is marked entry", () => {
		const stages = [
			{ outcome: StageOutcome.OPEN, isEntry: false, archivedAt: null },
		];

		expect(entryStageOf(stages)).toBeUndefined();
	});
});

describe("STAGE_SWATCHES", () => {
	it("has exactly 12 entries", () => {
		expect(STAGE_SWATCHES.length).toBe(12);
	});

	it("has no duplicate tokens", () => {
		expect(new Set(STAGE_SWATCHES).size).toBe(STAGE_SWATCHES.length);
	});

	it("is made of chart and swatch CSS variable references", () => {
		for (const token of STAGE_SWATCHES) {
			expect(token).toMatch(/^var\(--(chart|swatch)-\d\)$/);
		}
	});
});
