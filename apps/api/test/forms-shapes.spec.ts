import { describe, expect, it } from "bun:test";
import {
	FORMS,
	formFieldOptions,
	formSubmissionAnswer,
	publicFormConfig,
} from "@crm/db/forms";

describe("formFieldOptions", () => {
	it("accepts up to 50 entries of up to 120 chars", () => {
		const result = formFieldOptions.safeParse(
			Array.from({ length: 50 }, (_, i) => `option-${i}`),
		);

		expect(result.success).toBe(true);
	});

	it("rejects more than 50 entries", () => {
		const result = formFieldOptions.safeParse(
			Array.from({ length: 51 }, (_, i) => `option-${i}`),
		);

		expect(result.success).toBe(false);
	});

	it("rejects an entry longer than 120 chars", () => {
		const result = formFieldOptions.safeParse(["a".repeat(121)]);

		expect(result.success).toBe(false);
	});

	it("accepts an entry of exactly 120 chars", () => {
		const result = formFieldOptions.safeParse(["a".repeat(120)]);

		expect(result.success).toBe(true);
	});
});

describe("publicFormConfig", () => {
	const base = {
		id: "form_1",
		name: "Contact us",
		buttonLabel: "Send",
		confirmation: "Thanks",
		fields: [
			{
				id: "field_1",
				type: "EMAIL",
				label: "Email",
				required: true,
				contactFieldKey: "email",
			},
		],
	};

	it("strips contactFieldKey from a parsed field", () => {
		const parsed = publicFormConfig.parse(base);

		expect(parsed.fields[0]).not.toHaveProperty("contactFieldKey");
	});

	it("never admits contactFieldKey even when the schema shape is inspected", () => {
		const shapeKeys = Object.keys(publicFormConfig.shape.fields.element.shape);

		expect(shapeKeys).not.toContain("contactFieldKey");
	});

	it("accepts a well-formed config", () => {
		const result = publicFormConfig.safeParse(base);

		expect(result.success).toBe(true);
	});
});

describe("formSubmissionAnswer", () => {
	it("accepts an answer at the max length", () => {
		const result = formSubmissionAnswer.safeParse({
			fieldId: "field_1",
			label: "Message",
			value: "a".repeat(FORMS.field.answerMax),
		});

		expect(result.success).toBe(true);
	});

	it("rejects an answer over the max length", () => {
		const result = formSubmissionAnswer.safeParse({
			fieldId: "field_1",
			label: "Message",
			value: "a".repeat(FORMS.field.answerMax + 1),
		});

		expect(result.success).toBe(false);
	});
});

describe("FORMS constants", () => {
	it("matches the spec shape", () => {
		expect(FORMS).toEqual({
			submit: {
				minSeconds: 3,
				perMinute: 60,
				maxBodyBytes: 32_768,
			},
			field: {
				labelMax: 120,
				answerMax: 2000,
				maxFields: 30,
			},
			dedupeLeadWindowDays: 30,
			embedBudgetBytes: 6144,
		});
	});
});
