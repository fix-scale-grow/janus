import { JurisdictionKind, PermitType } from "@crm/db";
import {
	inspectionEntry,
	requiredDocumentEntry,
	worksheetTemplate,
} from "@crm/db/permits";
import { z } from "zod";
import { PERMITS } from "./permits.config";

const jurisdictionKindEnum = z.enum(
	Object.values(JurisdictionKind) as [JurisdictionKind, ...JurisdictionKind[]],
);

const permitTypeEnum = z.enum(
	Object.values(PermitType) as [PermitType, ...PermitType[]],
);

export const resolveJurisdictionInput = z.object({
	name: z.string().trim().min(1).max(160),
	kind: jurisdictionKindEnum,
	state: z.string().trim().min(2).max(2),
});

export type ResolveJurisdictionInput = z.infer<typeof resolveJurisdictionInput>;

export const playbookInput = z.object({
	jurisdictionId: z.string().min(1),
	permitType: permitTypeEnum,
	typeLabel: z.string().trim().max(160).optional(),
});

export type PlaybookInput = z.infer<typeof playbookInput>;

export const playbookIdInput = z.object({ id: z.string().min(1) });

export type PlaybookIdInput = z.infer<typeof playbookIdInput>;

export const FACT_SINGLETON_PATHS = [
	"neededWhen",
	"whoMayPull",
	"howToApply",
	"feeSchedule",
	"typicalTurnaround",
] as const;

export type FactSingletonPath = (typeof FACT_SINGLETON_PATHS)[number];

export const PREREQUISITE_PATH = /^prerequisites\.(\d+)$/;

export const factPathInput = z
	.string()
	.trim()
	.min(1)
	.refine(
		(value) =>
			(FACT_SINGLETON_PATHS as readonly string[]).includes(value) ||
			PREREQUISITE_PATH.test(value),
		{ message: "Unknown fact path." },
	);

export const setPlaybookFactInput = z.object({
	playbookId: z.string().min(1),
	factPath: factPathInput,
	value: z.string().trim().min(1).max(2000),
	sourceUrl: z.string().trim().url().max(500).nullable().optional(),
});

export type SetPlaybookFactInput = z.infer<typeof setPlaybookFactInput>;

export const playbookFactPathInput = z.object({
	playbookId: z.string().min(1),
	factPath: factPathInput,
});

export type PlaybookFactPathInput = z.infer<typeof playbookFactPathInput>;

export const setPlaybookDocumentsInput = z.object({
	playbookId: z.string().min(1),
	documents: requiredDocumentEntry.array().max(PERMITS.playbook.maxDocuments),
});

export type SetPlaybookDocumentsInput = z.infer<
	typeof setPlaybookDocumentsInput
>;

export const setPlaybookInspectionsInput = z.object({
	playbookId: z.string().min(1),
	inspections: inspectionEntry.array().max(PERMITS.playbook.maxInspections),
});

export type SetPlaybookInspectionsInput = z.infer<
	typeof setPlaybookInspectionsInput
>;

export const setWorksheetTemplateInput = z.object({
	playbookId: z.string().min(1),
	fields: worksheetTemplate,
});

export type SetWorksheetTemplateInput = z.infer<
	typeof setWorksheetTemplateInput
>;
