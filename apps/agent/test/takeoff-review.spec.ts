import { describe, expect, it } from "bun:test";
import { reviewTakeoff, SERVICE_PATTERNS } from "../agent/lib/takeoff-review";

describe("reviewTakeoff", () => {
	it("flags a measured shape with no service as unassigned", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s1",
					kind: "area",
					label: "North slope",
					service: "unassigned",
					hasQuantity: true,
				},
			],
			bookServices: [],
			estimateServiceNames: [],
		});

		expect(facts.unassignedShapes).toEqual([
			{ scopeId: "s1", kind: "area", label: "North slope" },
		]);
		expect(facts.taggedUnmeasuredShapes).toEqual([]);
	});

	it("does not flag an unmeasured shape with no service as unassigned", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s1",
					kind: "area",
					label: "North slope",
					service: "unassigned",
					hasQuantity: false,
				},
			],
			bookServices: [],
			estimateServiceNames: [],
		});

		expect(facts.unassignedShapes).toEqual([]);
	});

	it("flags a tagged shape with no measurement as tagged but unmeasured", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s2",
					kind: "line",
					label: "Ridge",
					service: "Tear-off",
					hasQuantity: false,
				},
			],
			bookServices: [],
			estimateServiceNames: [],
		});

		expect(facts.taggedUnmeasuredShapes).toEqual([
			{ scopeId: "s2", kind: "line", label: "Ridge", service: "Tear-off" },
		]);
		expect(facts.unassignedShapes).toEqual([]);
	});

	it("does not flag a tagged, measured shape at all", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s3",
					kind: "area",
					label: "South slope",
					service: "Tear-off",
					hasQuantity: true,
				},
			],
			bookServices: [],
			estimateServiceNames: [],
		});

		expect(facts.unassignedShapes).toEqual([]);
		expect(facts.taggedUnmeasuredShapes).toEqual([]);
	});

	it("raises a book service matching a pattern that is absent from the estimate", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s1",
					kind: "area",
					label: "Roof",
					service: "Tear-off",
					hasQuantity: true,
				},
			],
			bookServices: [
				{ id: "svc-1", name: "Tear-off" },
				{ id: "svc-2", name: "Debris disposal" },
			],
			estimateServiceNames: ["Tear-off"],
		});

		expect(facts.missingServiceQuestions).toEqual([
			{
				pattern: "disposal",
				label: "disposal",
				bookServices: ["Debris disposal"],
			},
		]);
	});

	it("does not raise a book service already on the estimate", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s1",
					kind: "area",
					label: "Roof",
					service: "Tear-off",
					hasQuantity: true,
				},
			],
			bookServices: [
				{ id: "svc-1", name: "Tear-off" },
				{ id: "svc-2", name: "Debris disposal" },
			],
			estimateServiceNames: ["Tear-off", "Debris Disposal"],
		});

		expect(facts.missingServiceQuestions).toEqual([]);
	});

	it("does not raise a question when nothing on the drawing is priced yet", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s1",
					kind: "area",
					label: "Roof",
					service: "unassigned",
					hasQuantity: false,
				},
			],
			bookServices: [{ id: "svc-2", name: "Debris disposal" }],
			estimateServiceNames: [],
		});

		expect(facts.missingServiceQuestions).toEqual([]);
	});

	it("does not raise a pattern the book has nothing matching", () => {
		const facts = reviewTakeoff({
			shapes: [
				{
					scopeId: "s1",
					kind: "area",
					label: "Roof",
					service: "Tear-off",
					hasQuantity: true,
				},
			],
			bookServices: [{ id: "svc-1", name: "Tear-off" }],
			estimateServiceNames: ["Tear-off"],
		});

		expect(facts.missingServiceQuestions).toEqual([]);
	});

	it("exposes the default patterns as data, not hardcoded logic", () => {
		expect(SERVICE_PATTERNS.map((pattern) => pattern.key)).toEqual([
			"disposal",
			"underlayment",
			"permit",
		]);
	});
});
