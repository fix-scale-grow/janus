import { PERMIT_STATUSES, type PermitStatus } from "./permit-status";

const DAY_MS = 86_400_000;

export const PERMIT_NAG = {
	expiryWarnDays: 30,
} as const;

export type NagDocument = {
	filePath: string | null;
	lockerDocumentId: string | null;
	sourceVerified: boolean | null;
};

export type NagInspection = {
	scheduledFor: string | Date | null;
	result: "PENDING" | "PASSED" | "FAILED";
	sourceVerified: boolean | null;
};

function startOfUtcDay(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function isDocumentAttached(
	doc: Pick<NagDocument, "filePath" | "lockerDocumentId">,
): boolean {
	return Boolean(doc.filePath || doc.lockerDocumentId);
}

export function isReadyToSubmitOrLater(status: PermitStatus): boolean {
	return (
		PERMIT_STATUSES.indexOf(status) >=
		PERMIT_STATUSES.indexOf("READY_TO_SUBMIT")
	);
}

export function missingDocumentCount(
	documents: Pick<NagDocument, "filePath" | "lockerDocumentId">[],
): number {
	return documents.filter((doc) => !isDocumentAttached(doc)).length;
}

export function hasMissingRequiredDocuments(params: {
	status: PermitStatus;
	documents: Pick<NagDocument, "filePath" | "lockerDocumentId">[];
}): boolean {
	if (!isReadyToSubmitOrLater(params.status)) return false;
	return missingDocumentCount(params.documents) > 0;
}

export function missingDocumentsMessage(count: number): string {
	return count === 1
		? "1 required document is missing."
		: `${count} required documents are missing.`;
}

export function isInspectionOverdue(
	inspection: Pick<NagInspection, "scheduledFor" | "result">,
	now: Date,
): boolean {
	if (inspection.result !== "PENDING" || !inspection.scheduledFor) return false;
	const scheduled = new Date(inspection.scheduledFor);
	return startOfUtcDay(scheduled) < startOfUtcDay(now);
}

export function hasOverdueInspection(
	inspections: Pick<NagInspection, "scheduledFor" | "result">[],
	now: Date,
): boolean {
	return inspections.some((inspection) => isInspectionOverdue(inspection, now));
}

export function hasUnverifiedPlaybookEntries(params: {
	documents: Pick<NagDocument, "sourceVerified">[];
	inspections: Pick<NagInspection, "sourceVerified">[];
}): boolean {
	return (
		params.documents.some((doc) => doc.sourceVerified === false) ||
		params.inspections.some((inspection) => inspection.sourceVerified === false)
	);
}

const EXPIRY_STATUSES: PermitStatus[] = ["ISSUED", "INSPECTIONS"];

export type ExpiryNag = { label: string; expired: boolean };

export function expiryNag(params: {
	status: PermitStatus;
	expiresAt: string | Date | null;
	now: Date;
}): ExpiryNag | null {
	const { status, expiresAt, now } = params;
	if (!EXPIRY_STATUSES.includes(status) || !expiresAt) return null;

	const daysLeft = Math.floor(
		(startOfUtcDay(new Date(expiresAt)) - startOfUtcDay(now)) / DAY_MS,
	);

	if (daysLeft < 0) return { label: "Expired date passed", expired: true };
	if (daysLeft > PERMIT_NAG.expiryWarnDays) return null;
	if (daysLeft === 0) return { label: "Expires today", expired: false };
	return {
		label: `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
		expired: false,
	};
}

export function hasAnyPermitNag(params: {
	status: PermitStatus;
	expiresAt: string | Date | null;
	documents: Pick<
		NagDocument,
		"filePath" | "lockerDocumentId" | "sourceVerified"
	>[];
	inspections: Pick<
		NagInspection,
		"scheduledFor" | "result" | "sourceVerified"
	>[];
	now: Date;
}): boolean {
	return (
		hasUnverifiedPlaybookEntries(params) ||
		hasMissingRequiredDocuments(params) ||
		hasOverdueInspection(params.inspections, params.now) ||
		expiryNag(params) !== null
	);
}
