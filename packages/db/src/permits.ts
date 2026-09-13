import { z } from "zod";
import type { PermitStatus } from "./generated/prisma/enums";

export const PERMIT_DISCLAIMER_VERSION = 1;
export const PERMIT_DISCLAIMER =
	"Janus assists with preparation. You are responsible for verifying all information and requirements with the issuing authority.";

export const PERMIT_TYPES = [
	"BUILDING",
	"ROOFING",
	"ELECTRICAL",
	"PLUMBING",
	"MECHANICAL",
	"OTHER",
] as const;

export const LOCKER_KINDS = [
	"LICENSE",
	"COI",
	"REGISTRATION",
	"OTHER",
] as const;
export type LockerKind = (typeof LOCKER_KINDS)[number];

export const provenanceFact = z.object({
	value: z.string().trim().min(1).max(2000),
	sourceUrl: z.string().trim().url().max(500).nullable(),
	verifiedById: z.string().nullable(),
	verifiedAt: z.coerce.date().nullable(),
});
export type ProvenanceFact = z.infer<typeof provenanceFact>;

export const requiredDocumentEntry = z.object({
	key: z.string().regex(/^[a-z0-9_]{1,60}$/),
	label: z.string().trim().min(1).max(160),
	reusable: z.boolean(),
	sourceUrl: z.string().trim().url().max(500).nullable(),
});

export const inspectionEntry = z.object({
	name: z.string().trim().min(1).max(120),
	when: z.string().trim().max(300).nullable(),
	criticalNote: z.string().trim().max(300).nullable(),
});

export const playbookFacts = z.object({
	neededWhen: provenanceFact.nullable().default(null),
	whoMayPull: provenanceFact.nullable().default(null),
	prerequisites: z.array(provenanceFact).max(20).default([]),
	howToApply: provenanceFact.nullable().default(null),
	feeSchedule: provenanceFact.nullable().default(null),
	typicalTurnaround: provenanceFact.nullable().default(null),
	requiredDocuments: z.array(requiredDocumentEntry).max(30).default([]),
	inspections: z.array(inspectionEntry).max(20).default([]),
});
export type PlaybookFacts = z.infer<typeof playbookFacts>;

export const WORKSHEET_PREFILL_KEYS = [
	"job_address",
	"job_name",
	"job_number",
	"job_valuation",
	"owner_name",
	"owner_email",
	"owner_phone",
	"contractor_name",
	"scope_of_work",
] as const;

export const worksheetField = z.object({
	key: z.string().regex(/^[a-z0-9_]{1,60}$/),
	label: z.string().trim().min(1).max(160),
	type: z.enum(["TEXT", "NUMBER", "DATE", "CHECKBOX"]),
	prefill: z.enum(WORKSHEET_PREFILL_KEYS).nullable(),
	required: z.boolean(),
});
export type WorksheetField = z.infer<typeof worksheetField>;
export const worksheetTemplate = z
	.array(worksheetField)
	.max(80)
	.refine(
		(fields) =>
			new Set(fields.map((field) => field.key)).size === fields.length,
		{ message: "Duplicate worksheet field key" },
	);

export const worksheetAnswer = z.object({
	value: z.string().max(4000),
	origin: z.enum(["HUMAN", "AI", "CRM", "LOCKER"]),
	state: z.enum(["NEEDS_REVIEW", "APPROVED"]),
	approvedById: z.string().nullable(),
	approvedAt: z.coerce.date().nullable(),
});
export type WorksheetAnswer = z.infer<typeof worksheetAnswer>;
export const worksheetAnswers = z.record(
	z.string().regex(/^[a-z0-9_]{1,60}$/),
	worksheetAnswer,
);
export type WorksheetAnswers = z.infer<typeof worksheetAnswers>;

const TRANSITIONS: Record<PermitStatus, PermitStatus[]> = {
	DRAFT: ["READY_TO_SUBMIT"],
	READY_TO_SUBMIT: ["DRAFT", "SUBMITTED"],
	SUBMITTED: ["ISSUED", "DENIED"],
	ISSUED: ["INSPECTIONS", "CLOSED", "EXPIRED"],
	INSPECTIONS: ["CLOSED", "EXPIRED"],
	CLOSED: [],
	DENIED: ["DRAFT"],
	EXPIRED: ["DRAFT"],
};
export function canTransition(from: PermitStatus, to: PermitStatus): boolean {
	return TRANSITIONS[from]?.includes(to) ?? false;
}

function firstIssueMessage(error: z.ZodError): string {
	const issue = error.issues[0];
	if (!issue) return "unknown issue";
	const path = issue.path.join(".") || "value";
	return `${path} ${issue.message}`;
}

export function parsePlaybookFacts(value: unknown): PlaybookFacts {
	try {
		return playbookFacts.parse(value);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(`Unreadable playbook facts: ${firstIssueMessage(error)}`);
		}
		throw error;
	}
}

export function parseWorksheetTemplate(value: unknown): WorksheetField[] {
	try {
		return worksheetTemplate.parse(value);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(
				`Unreadable worksheet template: ${firstIssueMessage(error)}`,
			);
		}
		throw error;
	}
}

export function parseWorksheetAnswers(value: unknown): WorksheetAnswers {
	try {
		return worksheetAnswers.parse(value);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(
				`Unreadable worksheet answers: ${firstIssueMessage(error)}`,
			);
		}
		throw error;
	}
}
