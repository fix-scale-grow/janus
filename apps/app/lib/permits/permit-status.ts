export const PERMIT_STATUSES = [
	"DRAFT",
	"READY_TO_SUBMIT",
	"SUBMITTED",
	"ISSUED",
	"DENIED",
	"EXPIRED",
	"INSPECTIONS",
	"CLOSED",
] as const;

export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
	DRAFT: "Draft",
	READY_TO_SUBMIT: "Ready to submit",
	SUBMITTED: "Submitted",
	ISSUED: "Issued",
	DENIED: "Denied",
	EXPIRED: "Expired",
	INSPECTIONS: "Inspections",
	CLOSED: "Closed",
};

export const PERMIT_TRANSITIONS: Record<PermitStatus, PermitStatus[]> = {
	DRAFT: ["READY_TO_SUBMIT"],
	READY_TO_SUBMIT: ["DRAFT", "SUBMITTED"],
	SUBMITTED: ["ISSUED", "DENIED"],
	ISSUED: ["INSPECTIONS", "CLOSED", "EXPIRED"],
	INSPECTIONS: ["CLOSED", "EXPIRED"],
	CLOSED: [],
	DENIED: ["DRAFT"],
	EXPIRED: ["DRAFT"],
};

export function permitTransitions(from: PermitStatus): PermitStatus[] {
	return PERMIT_TRANSITIONS[from] ?? [];
}

export function canTransitionPermit(
	from: PermitStatus,
	to: PermitStatus,
): boolean {
	return PERMIT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PERMIT_TYPES = [
	"BUILDING",
	"ROOFING",
	"ELECTRICAL",
	"PLUMBING",
	"MECHANICAL",
	"OTHER",
] as const;

export type PermitType = (typeof PERMIT_TYPES)[number];

export const PERMIT_TYPE_LABEL: Record<PermitType, string> = {
	BUILDING: "Building",
	ROOFING: "Roofing",
	ELECTRICAL: "Electrical",
	PLUMBING: "Plumbing",
	MECHANICAL: "Mechanical",
	OTHER: "Other",
};

export const JURISDICTION_KINDS = ["CITY", "COUNTY", "STATE"] as const;

export type JurisdictionKind = (typeof JURISDICTION_KINDS)[number];

export const JURISDICTION_KIND_LABEL: Record<JurisdictionKind, string> = {
	CITY: "City",
	COUNTY: "County",
	STATE: "State",
};

export const INSPECTION_RESULTS = ["PENDING", "PASSED", "FAILED"] as const;

export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const WORKSHEET_FIELD_TYPES = [
	"TEXT",
	"NUMBER",
	"DATE",
	"CHECKBOX",
] as const;

export type WorksheetFieldType = (typeof WORKSHEET_FIELD_TYPES)[number];

export const WORKSHEET_FIELD_TYPE_LABEL: Record<WorksheetFieldType, string> = {
	TEXT: "Text",
	NUMBER: "Number",
	DATE: "Date",
	CHECKBOX: "Checkbox",
};

export const WORKSHEET_ANSWER_ORIGINS = [
	"HUMAN",
	"AI",
	"CRM",
	"LOCKER",
] as const;

export type WorksheetAnswerOrigin = (typeof WORKSHEET_ANSWER_ORIGINS)[number];

export const WORKSHEET_ANSWER_ORIGIN_LABEL: Record<
	WorksheetAnswerOrigin,
	string
> = {
	HUMAN: "You typed",
	AI: "Janus drafted",
	CRM: "From the job records",
	LOCKER: "From the locker",
};

export const PERMIT_DISCLAIMER =
	"Janus assists with preparation. You are responsible for verifying all information and requirements with the issuing authority.";

export const PERMIT_DISCLAIMER_VERSION = 1;

export function isPermitDisclaimerAccepted(
	disclaimer: { version: number } | null,
): boolean {
	return (
		disclaimer !== null && disclaimer.version === PERMIT_DISCLAIMER_VERSION
	);
}

export const LOCKER_KINDS = [
	"LICENSE",
	"COI",
	"REGISTRATION",
	"OTHER",
] as const;

export type LockerKind = (typeof LOCKER_KINDS)[number];

export const LOCKER_KIND_LABEL: Record<LockerKind, string> = {
	LICENSE: "License",
	COI: "Certificate of insurance",
	REGISTRATION: "Registration",
	OTHER: "Other",
};

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

export type WorksheetPrefillKey = (typeof WORKSHEET_PREFILL_KEYS)[number];

export const WORKSHEET_PREFILL_LABEL: Record<WorksheetPrefillKey, string> = {
	job_address: "Job address",
	job_name: "Job name",
	job_number: "Job number",
	job_valuation: "Job valuation",
	owner_name: "Owner name",
	owner_email: "Owner email",
	owner_phone: "Owner phone",
	contractor_name: "Contractor name",
	scope_of_work: "Scope of work",
};

export const FACT_PATHS = [
	"neededWhen",
	"whoMayPull",
	"howToApply",
	"feeSchedule",
	"typicalTurnaround",
] as const;

export type FactPath = (typeof FACT_PATHS)[number];

export const FACT_PATH_LABEL: Record<FactPath, string> = {
	neededWhen: "When it's needed",
	whoMayPull: "Who may pull it",
	howToApply: "How to apply",
	feeSchedule: "Fee schedule",
	typicalTurnaround: "Typical turnaround",
};
