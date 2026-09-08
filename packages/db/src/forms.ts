import { z } from "zod";
import { FormFieldType } from "./generated/prisma/enums";

export const FORMS = {
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
} as const;

export const FORM_FIELD_OPTIONS_MAX = 50;

export const FORM_FIELD_OPTION_LABEL_MAX = 120;

export const formFieldTypeEnum = z.enum(FormFieldType);

export const formFieldOptions = z
	.array(z.string().trim().min(1).max(FORM_FIELD_OPTION_LABEL_MAX))
	.max(FORM_FIELD_OPTIONS_MAX);

export type FormFieldOptions = z.infer<typeof formFieldOptions>;

export const publicFormField = z.object({
	id: z.string(),
	type: formFieldTypeEnum,
	label: z.string().min(1).max(FORMS.field.labelMax),
	required: z.boolean(),
	options: formFieldOptions.optional(),
});

export type PublicFormField = z.infer<typeof publicFormField>;

export const publicFormConfig = z.object({
	id: z.string(),
	name: z.string(),
	intro: z.string().nullable().optional(),
	buttonLabel: z.string(),
	confirmation: z.string(),
	brandColor: z.string().nullable().optional(),
	fields: z.array(publicFormField).max(FORMS.field.maxFields),
});

export type PublicFormConfig = z.infer<typeof publicFormConfig>;

export const formSubmissionAnswer = z.object({
	fieldId: z.string(),
	label: z.string().max(FORMS.field.labelMax),
	value: z.string().trim().max(FORMS.field.answerMax),
});

export type FormSubmissionAnswer = z.infer<typeof formSubmissionAnswer>;

export const formSubmissionAnswers = z
	.array(formSubmissionAnswer)
	.max(FORMS.field.maxFields);

export type FormSubmissionAnswers = z.infer<typeof formSubmissionAnswers>;
