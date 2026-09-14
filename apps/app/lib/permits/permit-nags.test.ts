import { describe, expect, it } from "bun:test";
import {
	expiryNag,
	hasAnyPermitNag,
	hasMissingRequiredDocuments,
	hasOverdueInspection,
	hasUnverifiedPlaybookEntries,
	isInspectionOverdue,
	isReadyToSubmitOrLater,
	missingDocumentCount,
	missingDocumentsMessage,
} from "./permit-nags";

const NOW = new Date("2026-09-13T12:00:00.000Z");

describe("isReadyToSubmitOrLater", () => {
	it("is false for DRAFT", () => {
		expect(isReadyToSubmitOrLater("DRAFT")).toBe(false);
	});

	it("is true for READY_TO_SUBMIT and every status after it", () => {
		expect(isReadyToSubmitOrLater("READY_TO_SUBMIT")).toBe(true);
		expect(isReadyToSubmitOrLater("SUBMITTED")).toBe(true);
		expect(isReadyToSubmitOrLater("ISSUED")).toBe(true);
		expect(isReadyToSubmitOrLater("DENIED")).toBe(true);
		expect(isReadyToSubmitOrLater("EXPIRED")).toBe(true);
		expect(isReadyToSubmitOrLater("INSPECTIONS")).toBe(true);
		expect(isReadyToSubmitOrLater("CLOSED")).toBe(true);
	});
});

describe("missingDocumentCount and hasMissingRequiredDocuments", () => {
	const attached = { filePath: "a.pdf", lockerDocumentId: null };
	const fromLocker = { filePath: null, lockerDocumentId: "locker-1" };
	const missing = { filePath: null, lockerDocumentId: null };

	it("counts only unattached slots", () => {
		expect(missingDocumentCount([attached, fromLocker, missing])).toBe(1);
	});

	it("does not nag before READY_TO_SUBMIT", () => {
		expect(
			hasMissingRequiredDocuments({ status: "DRAFT", documents: [missing] }),
		).toBe(false);
	});

	it("nags at READY_TO_SUBMIT and later when a slot is unattached", () => {
		expect(
			hasMissingRequiredDocuments({
				status: "READY_TO_SUBMIT",
				documents: [missing],
			}),
		).toBe(true);
		expect(
			hasMissingRequiredDocuments({ status: "ISSUED", documents: [missing] }),
		).toBe(true);
	});

	it("does not nag when every slot is attached", () => {
		expect(
			hasMissingRequiredDocuments({
				status: "SUBMITTED",
				documents: [attached, fromLocker],
			}),
		).toBe(false);
	});
});

describe("missingDocumentsMessage", () => {
	it("uses singular wording for one", () => {
		expect(missingDocumentsMessage(1)).toBe("1 required document is missing.");
	});

	it("uses plural wording for more than one", () => {
		expect(missingDocumentsMessage(3)).toBe(
			"3 required documents are missing.",
		);
	});
});

describe("isInspectionOverdue and hasOverdueInspection", () => {
	it("is not overdue when result is not PENDING", () => {
		expect(
			isInspectionOverdue(
				{ scheduledFor: "2026-09-01T00:00:00.000Z", result: "PASSED" },
				NOW,
			),
		).toBe(false);
	});

	it("is not overdue with no scheduled date", () => {
		expect(
			isInspectionOverdue({ scheduledFor: null, result: "PENDING" }, NOW),
		).toBe(false);
	});

	it("is not overdue when scheduled for today", () => {
		expect(
			isInspectionOverdue(
				{ scheduledFor: "2026-09-13T00:00:00.000Z", result: "PENDING" },
				NOW,
			),
		).toBe(false);
	});

	it("is overdue when scheduled for a past day and still pending", () => {
		expect(
			isInspectionOverdue(
				{ scheduledFor: "2026-09-12T23:00:00.000Z", result: "PENDING" },
				NOW,
			),
		).toBe(true);
	});

	it("finds an overdue inspection in a list", () => {
		expect(
			hasOverdueInspection(
				[
					{ scheduledFor: "2026-09-01T00:00:00.000Z", result: "PENDING" },
					{ scheduledFor: "2026-09-20T00:00:00.000Z", result: "PENDING" },
				],
				NOW,
			),
		).toBe(true);
	});
});

describe("hasUnverifiedPlaybookEntries", () => {
	it("is true when a document is explicitly unverified", () => {
		expect(
			hasUnverifiedPlaybookEntries({
				documents: [{ sourceVerified: false }],
				inspections: [],
			}),
		).toBe(true);
	});

	it("is true when an inspection is explicitly unverified", () => {
		expect(
			hasUnverifiedPlaybookEntries({
				documents: [],
				inspections: [{ sourceVerified: false }],
			}),
		).toBe(true);
	});

	it("ignores null sourceVerified (pre-batch or human-added rows)", () => {
		expect(
			hasUnverifiedPlaybookEntries({
				documents: [{ sourceVerified: null }],
				inspections: [{ sourceVerified: null }],
			}),
		).toBe(false);
	});

	it("is false once every entry is verified", () => {
		expect(
			hasUnverifiedPlaybookEntries({
				documents: [{ sourceVerified: true }],
				inspections: [{ sourceVerified: true }],
			}),
		).toBe(false);
	});
});

describe("expiryNag", () => {
	it("is null outside ISSUED and INSPECTIONS", () => {
		expect(
			expiryNag({
				status: "SUBMITTED",
				expiresAt: "2026-09-14T00:00:00.000Z",
				now: NOW,
			}),
		).toBeNull();
	});

	it("is null with no expiry date", () => {
		expect(
			expiryNag({ status: "ISSUED", expiresAt: null, now: NOW }),
		).toBeNull();
	});

	it("is null when more than 30 days remain", () => {
		expect(
			expiryNag({
				status: "ISSUED",
				expiresAt: "2026-12-01T00:00:00.000Z",
				now: NOW,
			}),
		).toBeNull();
	});

	it("reports expiring today", () => {
		expect(
			expiryNag({
				status: "ISSUED",
				expiresAt: "2026-09-13T00:00:00.000Z",
				now: NOW,
			}),
		).toEqual({ label: "Expires today", expired: false });
	});

	it("reports days remaining within the warn window", () => {
		expect(
			expiryNag({
				status: "INSPECTIONS",
				expiresAt: "2026-09-20T00:00:00.000Z",
				now: NOW,
			}),
		).toEqual({ label: "Expires in 7 days", expired: false });
	});

	it("singularizes one day remaining", () => {
		expect(
			expiryNag({
				status: "ISSUED",
				expiresAt: "2026-09-14T00:00:00.000Z",
				now: NOW,
			}),
		).toEqual({ label: "Expires in 1 day", expired: false });
	});

	it("reports an expired permit as past due", () => {
		expect(
			expiryNag({
				status: "ISSUED",
				expiresAt: "2026-09-01T00:00:00.000Z",
				now: NOW,
			}),
		).toEqual({ label: "Expired date passed", expired: true });
	});
});

describe("hasAnyPermitNag", () => {
	const base = {
		status: "READY_TO_SUBMIT" as const,
		expiresAt: null,
		documents: [],
		inspections: [],
		now: NOW,
	};

	it("is false when nothing is wrong", () => {
		expect(hasAnyPermitNag(base)).toBe(false);
	});

	it("is true when documents are unattached at READY_TO_SUBMIT", () => {
		expect(
			hasAnyPermitNag({
				...base,
				documents: [
					{ filePath: null, lockerDocumentId: null, sourceVerified: true },
				],
			}),
		).toBe(true);
	});

	it("is true when an inspection is overdue", () => {
		expect(
			hasAnyPermitNag({
				...base,
				inspections: [
					{
						scheduledFor: "2026-09-01T00:00:00.000Z",
						result: "PENDING",
						sourceVerified: true,
					},
				],
			}),
		).toBe(true);
	});

	it("is true when the permit is expiring soon", () => {
		expect(
			hasAnyPermitNag({
				...base,
				status: "ISSUED",
				expiresAt: "2026-09-15T00:00:00.000Z",
			}),
		).toBe(true);
	});
});
