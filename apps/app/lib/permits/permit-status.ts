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
