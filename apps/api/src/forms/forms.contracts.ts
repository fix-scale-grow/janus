import { FORMS, formFieldOptions, formFieldTypeEnum } from "@crm/db/forms";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

export const formFieldInput = z.object({
	id: z.string().optional(),
	type: formFieldTypeEnum,
	label: z.string().trim().min(1).max(FORMS.field.labelMax),
	required: z.boolean().default(false),
	options: formFieldOptions.optional(),
	contactFieldKey: z.string().trim().min(1).nullable().optional(),
});

export type FormFieldInput = z.infer<typeof formFieldInput>;

export const formListInput = listInput;

export type FormListInput = z.infer<typeof formListInput>;

export const formIdInput = z.object({ id: z.string() });

export const formCreateInput = z.object({
	name: z.string().trim().min(1, "A form needs a name."),
	intro: z.string().trim().max(2000).nullable().optional(),
	buttonLabel: z.string().trim().min(1).max(80).default("Send"),
	confirmation: z
		.string()
		.trim()
		.min(1)
		.max(2000)
		.default("Thanks — we'll be in touch shortly."),
	createLead: z.boolean().default(true),
	notifyEmails: z.string().trim().max(2000).nullable().optional(),
	fields: z.array(formFieldInput).min(1).max(FORMS.field.maxFields),
});

export type FormCreateInput = z.infer<typeof formCreateInput>;

const formUpdateData = z.object({
	name: z.string().trim().min(1).optional(),
	intro: z.string().trim().max(2000).nullable().optional(),
	buttonLabel: z.string().trim().min(1).max(80).optional(),
	confirmation: z.string().trim().min(1).max(2000).optional(),
	createLead: z.boolean().optional(),
	notifyEmails: z.string().trim().max(2000).nullable().optional(),
});

export const formUpdateArgs = z.object({
	id: z.string(),
	data: formUpdateData,
});

export type FormUpdateInput = z.infer<typeof formUpdateData>;

export const formUpdateFieldsInput = z.object({
	formId: z.string(),
	fields: z.array(formFieldInput).min(1).max(FORMS.field.maxFields),
});

export type FormUpdateFieldsInput = z.infer<typeof formUpdateFieldsInput>;

export const formSetActiveInput = z.object({
	id: z.string(),
	active: z.boolean(),
});

export const formSubmissionsInput = z.object({
	formId: z.string(),
	listInput,
});

export type FormSubmissionsInput = z.infer<typeof formSubmissionsInput>;

const rawTouch = z
	.object({
		source: z.string().optional(),
		medium: z.string().optional(),
		campaign: z.string().optional(),
		term: z.string().optional(),
		content: z.string().optional(),
		referrer: z.string().optional(),
		landing: z.string().optional(),
		at: z.number().optional(),
	})
	.optional();

export const formSubmitInput = z.object({
	formId: z.string(),
	answers: z
		.record(z.string(), z.string().max(FORMS.field.answerMax))
		.default({}),
	honeypot: z.string().max(500).trim().default(""),
	renderedAt: z.number().nonnegative(),
	host: z.string().trim().min(1).max(253),
	path: z.string().trim().max(512).default("/"),
	visitorId: z.string().nullable().optional(),
	touch: rawTouch,
	firstTouch: rawTouch,
});

export type FormSubmitInput = z.infer<typeof formSubmitInput>;

export const formSubmitResult = z.union([
	z.object({ ok: z.literal(true) }),
	z.object({
		ok: z.literal(false),
		errors: z.record(z.string(), z.string()),
	}),
]);

export type FormSubmitResult = z.infer<typeof formSubmitResult>;
