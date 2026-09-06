import { TemplatePurpose } from "@crm/db";
import { z } from "zod";

const templatePurposeEnum = z.enum(
	Object.values(TemplatePurpose) as [TemplatePurpose, ...TemplatePurpose[]],
);

export const templateByPurposeInput = z.object({
	purpose: templatePurposeEnum,
});

export type TemplateByPurposeInput = z.infer<typeof templateByPurposeInput>;

export const templateUpdateInput = z.object({
	purpose: templatePurposeEnum,
	name: z.string().trim().min(1, "A template needs a name.").max(200),
	subject: z.string().trim().max(200).optional(),
	blocks: z.unknown(),
});

export type TemplateUpdateInput = z.infer<typeof templateUpdateInput>;

export const templatePreviewInput = z.object({
	purpose: templatePurposeEnum,
	contactId: z.string().optional(),
	dealId: z.string().optional(),
	estimateId: z.string().optional(),
	invoiceId: z.string().optional(),
});

export type TemplatePreviewInput = z.infer<typeof templatePreviewInput>;

export const templateSendTestInput = z.object({
	purpose: templatePurposeEnum,
	to: z.email("That is not an email address."),
});

export type TemplateSendTestInput = z.infer<typeof templateSendTestInput>;
