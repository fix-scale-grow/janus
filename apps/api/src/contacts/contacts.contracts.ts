import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";
import { recordFieldValues } from "../fields/fields.contracts";
import { listInput } from "../trpc/list-input";

export const contactListInput = listInput.extend({
	owner: z.string().default("all"),
	source: z.string().default("all"),
});

export type ContactListInput = z.infer<typeof contactListInput>;

export const contactOptionsInput = z.object({
	q: z.string().default(""),
});

export type ContactOptionsInput = z.infer<typeof contactOptionsInput>;

export const contactCreateInput = z.object({
	firstName: z.string().trim().min(1, "A contact needs a first name."),
	lastName: z.string().trim().optional(),
	email: z.email("That is not an email address.").optional().or(z.literal("")),
	phone: z.string().trim().optional(),
	title: z.string().trim().optional(),
	companyName: z
		.string()
		.trim()
		.max(200, "That company name is too long.")
		.optional(),
	ownerId: z.string().nullable().optional(),
});

export type ContactCreateInput = z.infer<typeof contactCreateInput>;

const contactUpdateInput = z.object({
	firstName: z.string().trim().min(1).optional(),
	lastName: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	title: z.string().optional(),
	companyName: z
		.string()
		.trim()
		.max(200, "That company name is too long.")
		.optional(),
	ownerId: z.string().nullable().optional(),
	fields: recordFieldValues.optional(),
});

export type ContactUpdateInput = z.infer<typeof contactUpdateInput>;

export const contactUpdateArgs = z.object({
	id: z.string(),
	data: contactUpdateInput,
});

export const contactIdInput = z.object({ id: z.string() });

export const contactBulkInput = bulkIdsInput;

export const contactBulkOwnerInput = bulkIdsInput.extend({
	ownerId: z.string().nullable(),
});

export type ContactBulkOwnerInput = z.infer<typeof contactBulkOwnerInput>;

export const factDecisionInput = z.object({
	factId: z.string(),
	decision: z.enum(["accept", "dismiss"]),
});

export type FactDecisionInput = z.infer<typeof factDecisionInput>;
