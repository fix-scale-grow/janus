import {
	InspectionResult,
	JurisdictionKind,
	PermitStatus,
	PermitType,
} from "@crm/db";
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

const permitStatusEnum = z.enum(
	Object.values(PermitStatus) as [PermitStatus, ...PermitStatus[]],
);

const inspectionResultEnum = z.enum(
	Object.values(InspectionResult) as [InspectionResult, ...InspectionResult[]],
);

const worksheetKey = z.string().regex(/^[a-z0-9_]{1,60}$/);

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

export const permitDealIdInput = z.object({ dealId: z.string().min(1) });

export type PermitDealIdInput = z.infer<typeof permitDealIdInput>;

export const permitIdInput = z.object({ permitId: z.string().min(1) });

export type PermitIdInput = z.infer<typeof permitIdInput>;

export const permitListInput = z.object({
	status: permitStatusEnum.optional(),
	jurisdictionId: z.string().min(1).optional(),
	page: z.number().int().min(1).default(1),
});

export type PermitListInput = z.infer<typeof permitListInput>;

export const createPermitInput = z.object({
	dealId: z.string().min(1),
	jurisdictionId: z.string().min(1),
	permitType: permitTypeEnum,
	typeLabel: z.string().trim().max(160).optional(),
});

export type CreatePermitInput = z.infer<typeof createPermitInput>;

export const setPermitStatusInput = z.object({
	permitId: z.string().min(1),
	status: permitStatusEnum,
	deniedReason: z.string().trim().max(2000).optional(),
});

export type SetPermitStatusInput = z.infer<typeof setPermitStatusInput>;

export const updatePermitInput = z.object({
	permitId: z.string().min(1),
	permitNumber: z.string().trim().max(120).nullable().optional(),
	feeCents: z
		.number()
		.int()
		.min(0)
		.max(PERMITS.permit.maxFeeCents)
		.nullable()
		.optional(),
	expiresAt: z.coerce.date().nullable().optional(),
});

export type UpdatePermitInput = z.infer<typeof updatePermitInput>;

export const setPermitAnswerInput = z.object({
	permitId: z.string().min(1),
	key: worksheetKey,
	value: z.string().max(4000),
});

export type SetPermitAnswerInput = z.infer<typeof setPermitAnswerInput>;

export const approvePermitAnswerInput = z.object({
	permitId: z.string().min(1),
	key: worksheetKey,
	value: z.string().max(4000).optional(),
});

export type ApprovePermitAnswerInput = z.infer<typeof approvePermitAnswerInput>;

export const clearPermitAnswerInput = z.object({
	permitId: z.string().min(1),
	key: worksheetKey,
});

export type ClearPermitAnswerInput = z.infer<typeof clearPermitAnswerInput>;

export const attachChecklistDocumentInput = z.object({
	permitId: z.string().min(1),
	slotKey: z.string().min(1).max(60),
	lockerDocumentId: z.string().min(1).nullable().optional(),
});

export type AttachChecklistDocumentInput = z.infer<
	typeof attachChecklistDocumentInput
>;

export const setInspectionInput = z.object({
	permitId: z.string().min(1),
	inspectionId: z.string().min(1).optional(),
	name: z.string().trim().min(1).max(120),
	scheduledFor: z.coerce.date().nullable().optional(),
	result: inspectionResultEnum.optional(),
	note: z.string().trim().max(2000).nullable().optional(),
});

export type SetInspectionInput = z.infer<typeof setInspectionInput>;

export const inspectionIdInput = z.object({
	inspectionId: z.string().min(1),
});

export type InspectionIdInput = z.infer<typeof inspectionIdInput>;

export const lockerRenameInput = z.object({
	lockerDocumentId: z.string().min(1),
	label: z.string().trim().min(1).max(160),
	kind: z.string().trim().min(1).max(60).optional(),
});

export type LockerRenameInput = z.infer<typeof lockerRenameInput>;
