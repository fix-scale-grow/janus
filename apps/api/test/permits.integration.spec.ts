import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@crm/db";
import { PERMIT_DISCLAIMER_VERSION } from "@crm/db/permits";
import { acceptPermitDisclaimerSetting } from "@crm/db/settings";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { PermitPrefillService } from "../src/permits/permit-prefill.service";
import { lockerRenameInput } from "../src/permits/permits.contracts";
import { PermitsService } from "../src/permits/permits.service";
import { PlaybooksService } from "../src/permits/playbooks.service";

const suffix = process.env.TEST_RUN_ID ?? "permits-spec";

const playbooks = new PlaybooksService(db);
const prefill = new PermitPrefillService(db);
const permits = new PermitsService(db, playbooks, prefill);

let userId: string;
let dealId: string;
let stageId: string;
let jurisdictionId: string;
let playbookId: string;
let contactId: string;

async function expectRejects(
	promise: Promise<unknown>,
	errorType: new (...args: never[]) => Error,
): Promise<void> {
	let caught: unknown;
	try {
		await promise;
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(errorType);
}

beforeAll(async () => {
	const user = await db.user.create({
		data: {
			id: `permits-user-${suffix}`,
			name: "Permits Rep",
			email: `permits-rep-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	const stage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	stageId = stage.id;

	const deal = await db.deal.create({
		data: {
			id: `permits-deal-${suffix}`,
			name: `Permits Deal ${suffix}`,
			ownerId: userId,
			stageId,
		},
		select: { id: true },
	});
	dealId = deal.id;

	const contact = await db.contact.create({
		data: {
			id: `permits-contact-${suffix}`,
			firstName: "Owen",
			lastName: "Owner",
			email: `owen-${suffix}@example.test`,
			phone: "555-0100",
		},
		select: { id: true },
	});
	contactId = contact.id;

	await db.dealContact.create({
		data: { dealId, contactId },
	});

	const jurisdiction = await permits.resolveJurisdiction({
		name: `Permit City ${suffix}`,
		kind: "CITY",
		state: "CO",
	});
	jurisdictionId = jurisdiction.id;

	const playbook = await playbooks.findOrCreate({
		jurisdictionId,
		permitType: "ROOFING",
	});
	playbookId = playbook.id;

	await playbooks.setDocuments({
		playbookId,
		documents: [
			{
				key: "site_plan",
				label: "Site plan",
				reusable: true,
				sourceUrl: null,
				lockerKind: null,
				verifiedById: null,
				verifiedAt: null,
			},
			{
				key: "elevations",
				label: "Elevations",
				reusable: false,
				sourceUrl: null,
				lockerKind: null,
				verifiedById: null,
				verifiedAt: null,
			},
		],
	});

	await playbooks.setInspections({
		playbookId,
		inspections: [
			{
				name: "Final inspection",
				when: null,
				criticalNote: "Bring ladder",
				verifiedById: null,
				verifiedAt: null,
			},
		],
	});

	await playbooks.setWorksheetTemplate({
		playbookId,
		fields: [
			{
				key: "job_name",
				label: "Job name",
				type: "TEXT",
				prefill: "job_name",
				required: true,
			},
			{
				key: "owner_email",
				label: "Owner email",
				type: "TEXT",
				prefill: "owner_email",
				required: false,
			},
			{
				key: "scope_of_work",
				label: "Scope of work",
				type: "TEXT",
				prefill: "scope_of_work",
				required: false,
			},
		],
	});
});

afterAll(async () => {
	await db.permitDocument.deleteMany({ where: { permit: { dealId } } });
	await db.permitInspection.deleteMany({ where: { permit: { dealId } } });
	await db.permitPromptDismissal.deleteMany({ where: { dealId } });
	await db.permit.deleteMany({ where: { dealId } });
	await db.permitPlaybook.deleteMany({ where: { jurisdictionId } });
	await db.jurisdiction.deleteMany({ where: { id: jurisdictionId } });
	await db.dealContact.deleteMany({ where: { dealId } });
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.user.deleteMany({ where: { id: userId } });
});

async function createPermit() {
	return permits.create(
		{ dealId, jurisdictionId, permitType: "ROOFING" },
		userId,
	);
}

describe("PermitsService.create", () => {
	it("scaffolds checklist documents and inspections from the playbook", async () => {
		const permit = await createPermit();

		const found = await permits.byId(permit.id);
		expect(found.documents).toHaveLength(2);
		expect(found.documents[0]?.slotKey).toBe("site_plan");
		expect(found.documents[0]?.label).toBe("Site plan");
		expect(found.documents[0]?.sortOrder).toBe(0);
		expect(found.documents[1]?.slotKey).toBe("elevations");
		expect(found.documents[1]?.sortOrder).toBe(1);

		expect(found.inspections).toHaveLength(1);
		expect(found.inspections[0]?.name).toBe("Final inspection");
		expect(found.inspections[0]?.criticalNote).toBe("Bring ladder");

		expect(found.worksheetTemplate).toHaveLength(3);
	});

	it("stamps sourceVerified from the playbook entry's verification at scaffold time", async () => {
		const jurisdiction = await permits.resolveJurisdiction({
			name: `Provenance ${suffix}`,
			kind: "CITY",
			state: "CO",
		});
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "MECHANICAL",
		});
		await playbooks.setDocuments({
			playbookId: playbook.id,
			documents: [
				{
					key: "site_plan",
					label: "Site plan",
					reusable: true,
					sourceUrl: null,
					lockerKind: null,
					verifiedById: null,
					verifiedAt: null,
				},
			],
		});
		await playbooks.setInspections({
			playbookId: playbook.id,
			inspections: [
				{
					name: "Rough-in",
					when: null,
					criticalNote: null,
					verifiedById: null,
					verifiedAt: null,
				},
			],
		});
		await playbooks.verifyDocument(
			{ playbookId: playbook.id, key: "site_plan" },
			userId,
		);
		await playbooks.verifyInspection(
			{ playbookId: playbook.id, index: 0 },
			userId,
		);

		const permit = await permits.create(
			{ dealId, jurisdictionId: jurisdiction.id, permitType: "MECHANICAL" },
			userId,
		);
		const found = await permits.byId(permit.id);
		expect(found.documents[0]?.sourceVerified).toBe(true);
		expect(found.inspections[0]?.sourceVerified).toBe(true);

		await db.permit.deleteMany({ where: { id: permit.id } });
		await db.permitPlaybook.deleteMany({ where: { id: playbook.id } });
		await db.jurisdiction.deleteMany({ where: { id: jurisdiction.id } });
	});

	it("auto-attaches the newest matching locker document for a reusable slot with a locker kind", async () => {
		const jurisdiction = await permits.resolveJurisdiction({
			name: `Auto Attach ${suffix}`,
			kind: "CITY",
			state: "CO",
		});
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "PLUMBING",
		});
		await playbooks.setDocuments({
			playbookId: playbook.id,
			documents: [
				{
					key: "coi",
					label: "Certificate of insurance",
					reusable: true,
					sourceUrl: null,
					lockerKind: "COI",
					verifiedById: null,
					verifiedAt: null,
				},
			],
		});

		const older = await db.lockerDocument.create({
			data: {
				id: `auto-attach-old-${suffix}`,
				label: "Old COI",
				kind: "COI",
				fileName: "old.pdf",
				contentType: "application/pdf",
				createdById: userId,
			},
		});
		const newer = await db.lockerDocument.create({
			data: {
				id: `auto-attach-new-${suffix}`,
				label: "New COI",
				kind: "COI",
				fileName: "new.pdf",
				contentType: "application/pdf",
				createdById: userId,
				createdAt: new Date(older.createdAt.getTime() + 1000),
			},
		});

		const permit = await permits.create(
			{ dealId, jurisdictionId: jurisdiction.id, permitType: "PLUMBING" },
			userId,
		);
		const found = await permits.byId(permit.id);
		expect(found.documents[0]?.lockerDocumentId).toBe(newer.id);
		expect(found.documents[0]?.attachedAt).toBeInstanceOf(Date);

		await db.permit.deleteMany({ where: { id: permit.id } });
		await db.lockerDocument.deleteMany({
			where: { id: { in: [older.id, newer.id] } },
		});
		await db.permitPlaybook.deleteMany({ where: { id: playbook.id } });
		await db.jurisdiction.deleteMany({ where: { id: jurisdiction.id } });
	});
});

describe("PermitsService transitions", () => {
	it("walks DRAFT through CLOSED, refusing CLOSED while an inspection is pending", async () => {
		const permit = await createPermit();

		await permits.setStatus({ permitId: permit.id, status: "READY_TO_SUBMIT" });
		await permits.setStatus({ permitId: permit.id, status: "SUBMITTED" });
		const submitted = await permits.byId(permit.id);
		expect(submitted.submittedAt).toBeInstanceOf(Date);

		await permits.setStatus({ permitId: permit.id, status: "ISSUED" });
		const issued = await permits.byId(permit.id);
		expect(issued.issuedAt).toBeInstanceOf(Date);

		await permits.setStatus({ permitId: permit.id, status: "INSPECTIONS" });

		await expectRejects(
			permits.setStatus({ permitId: permit.id, status: "CLOSED" }),
			BadRequestException,
		);

		const inspection = issued.inspections[0];
		if (!inspection) throw new Error("expected a scaffolded inspection");
		await permits.setInspection({
			permitId: permit.id,
			inspectionId: inspection.id,
			name: inspection.name,
			result: "PASSED",
		});

		await permits.setStatus({ permitId: permit.id, status: "CLOSED" });
		const closed = await permits.byId(permit.id);
		expect(closed.status).toBe("CLOSED");
		expect(closed.closedAt).toBeInstanceOf(Date);
	});

	it("closes cleanly when a permit has zero inspections", async () => {
		const jurisdiction = await permits.resolveJurisdiction({
			name: `No Inspections ${suffix}`,
			kind: "CITY",
			state: "CO",
		});
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "ELECTRICAL",
		});

		const permit = await permits.create(
			{ dealId, jurisdictionId: jurisdiction.id, permitType: "ELECTRICAL" },
			userId,
		);

		await permits.setStatus({ permitId: permit.id, status: "READY_TO_SUBMIT" });
		await permits.setStatus({ permitId: permit.id, status: "SUBMITTED" });
		await permits.setStatus({ permitId: permit.id, status: "ISSUED" });
		await permits.setStatus({ permitId: permit.id, status: "CLOSED" });

		const closed = await permits.byId(permit.id);
		expect(closed.status).toBe("CLOSED");

		await db.permit.deleteMany({ where: { id: permit.id } });
		await db.permitPlaybook.deleteMany({ where: { id: playbook.id } });
		await db.jurisdiction.deleteMany({ where: { id: jurisdiction.id } });
	});

	it("requires a reason to deny", async () => {
		const permit = await createPermit();
		await permits.setStatus({ permitId: permit.id, status: "READY_TO_SUBMIT" });
		await permits.setStatus({ permitId: permit.id, status: "SUBMITTED" });

		await expectRejects(
			permits.setStatus({ permitId: permit.id, status: "DENIED" }),
			BadRequestException,
		);

		await permits.setStatus({
			permitId: permit.id,
			status: "DENIED",
			deniedReason: "Missing survey",
		});
		const denied = await permits.byId(permit.id);
		expect(denied.status).toBe("DENIED");
		expect(denied.deniedReason).toBe("Missing survey");

		await permits.setStatus({ permitId: permit.id, status: "DRAFT" });
		const backToDraft = await permits.byId(permit.id);
		expect(backToDraft.status).toBe("DRAFT");
	});

	it("400s an illegal jump", async () => {
		const permit = await createPermit();
		await expectRejects(
			permits.setStatus({ permitId: permit.id, status: "SUBMITTED" }),
			BadRequestException,
		);
	});
});

describe("PermitsService worksheet approvals", () => {
	it("applyPrefills fills mapped fields NEEDS_REVIEW and skips an already-answered key", async () => {
		const permit = await createPermit();

		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Manually typed" },
			userId,
		);

		const filled = await permits.applyPrefills({ permitId: permit.id });

		expect(filled.worksheetAnswers.job_name?.value).toBe("Manually typed");
		expect(filled.worksheetAnswers.job_name?.state).toBe("APPROVED");
		expect(filled.worksheetAnswers.job_name?.origin).toBe("HUMAN");

		expect(filled.worksheetAnswers.owner_email?.value).toBe(
			`owen-${suffix}@example.test`,
		);
		expect(filled.worksheetAnswers.owner_email?.state).toBe("NEEDS_REVIEW");
		expect(filled.worksheetAnswers.owner_email?.origin).toBe("CRM");

		expect(filled.worksheetAnswers.scope_of_work).toBeUndefined();
	});

	it("400s setAnswer for a key that is not on the live worksheet template", async () => {
		const permit = await createPermit();
		await expectRejects(
			permits.setAnswer(
				{ permitId: permit.id, key: "not_a_real_field", value: "sneaky" },
				userId,
			),
			BadRequestException,
		);
	});

	it("approveAllReviewed stamps the caller on every NEEDS_REVIEW row", async () => {
		const permit = await createPermit();
		await permits.applyPrefills({ permitId: permit.id });

		const before = await permits.byId(permit.id);
		expect(before.worksheetAnswers.owner_email?.state).toBe("NEEDS_REVIEW");

		const approved = await permits.approveAllReviewed(
			{ permitId: permit.id },
			userId,
		);

		for (const answer of Object.values(approved.worksheetAnswers)) {
			expect(answer.state).toBe("APPROVED");
			expect(answer.approvedById).toBe(userId);
			expect(answer.approvedAt).toBeInstanceOf(Date);
		}
	});

	it("writeAgentAnswers never produces APPROVED and never touches an approved answer", async () => {
		const permit = await createPermit();

		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Locked by human" },
			userId,
		);

		await permits.writeAgentAnswers(permit.id, {
			job_name: "Agent overwrite attempt",
			owner_email: "agent@example.test",
			not_a_template_key: "ignored",
		});

		const found = await permits.byId(permit.id);
		expect(found.worksheetAnswers.job_name?.value).toBe("Locked by human");
		expect(found.worksheetAnswers.job_name?.state).toBe("APPROVED");
		expect(found.worksheetAnswers.job_name?.origin).toBe("HUMAN");

		expect(found.worksheetAnswers.owner_email?.value).toBe(
			"agent@example.test",
		);
		expect(found.worksheetAnswers.owner_email?.state).toBe("NEEDS_REVIEW");
		expect(found.worksheetAnswers.owner_email?.origin).toBe("AI");
		expect(found.worksheetAnswers.owner_email?.approvedById).toBeNull();

		expect(found.worksheetAnswers.not_a_template_key).toBeUndefined();
	});

	it("worksheetStatus reports allApproved and requiredMissing", async () => {
		const permit = await createPermit();

		const empty = await permits.byId(permit.id);
		expect(empty.worksheetStatus.requiredMissing).toEqual(["job_name"]);
		expect(empty.worksheetStatus.allApproved).toBe(true);

		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Filled" },
			userId,
		);
		const filled = await permits.byId(permit.id);
		expect(filled.worksheetStatus.requiredMissing).toEqual([]);
		expect(filled.worksheetStatus.allApproved).toBe(true);

		await permits.applyPrefills({ permitId: permit.id });
		const withReview = await permits.byId(permit.id);
		expect(withReview.worksheetStatus.allApproved).toBe(false);
	});

	it("neither blocks nor counts a NEEDS_REVIEW answer whose key was removed from the template", async () => {
		const permit = await createPermit();
		await permits.applyPrefills({ permitId: permit.id });
		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Filled job" },
			userId,
		);

		const withReview = await permits.byId(permit.id);
		expect(withReview.worksheetStatus.needsReviewCount).toBeGreaterThan(0);

		await playbooks.setWorksheetTemplate({
			playbookId,
			fields: [
				{
					key: "job_name",
					label: "Job name",
					type: "TEXT",
					prefill: "job_name",
					required: true,
				},
			],
		});

		try {
			const afterRemoval = await permits.byId(permit.id);
			expect(afterRemoval.worksheetStatus.needsReviewCount).toBe(0);
			expect(afterRemoval.worksheetStatus.allApproved).toBe(true);
			expect(afterRemoval.worksheetAnswers.owner_email?.state).toBe(
				"NEEDS_REVIEW",
			);

			await acceptPermitDisclaimerSetting(
				db,
				userId,
				PERMIT_DISCLAIMER_VERSION,
			);
			const result = await permits.worksheetPdf({ permitId: permit.id });
			expect(result.base64.length).toBeGreaterThan(0);
		} finally {
			await resetDisclaimer();
			await playbooks.setWorksheetTemplate({
				playbookId,
				fields: [
					{
						key: "job_name",
						label: "Job name",
						type: "TEXT",
						prefill: "job_name",
						required: true,
					},
					{
						key: "owner_email",
						label: "Owner email",
						type: "TEXT",
						prefill: "owner_email",
						required: false,
					},
					{
						key: "scope_of_work",
						label: "Scope of work",
						type: "TEXT",
						prefill: "scope_of_work",
						required: false,
					},
				],
			});
		}
	});
});

describe("PermitsService checklist", () => {
	it("attaches and detaches a locker document reference", async () => {
		const permit = await createPermit();
		const found = await permits.byId(permit.id);
		const slot = found.documents[0];
		if (!slot) throw new Error("expected a scaffolded checklist slot");

		const locker = await db.lockerDocument.create({
			data: {
				id: `permits-locker-${suffix}`,
				label: "Site plan scan",
				fileName: "site-plan.pdf",
				contentType: "application/pdf",
				createdById: userId,
			},
		});

		const attached = await permits.attachChecklistDocument({
			permitId: permit.id,
			slotKey: slot.slotKey,
			lockerDocumentId: locker.id,
		});
		expect(attached.lockerDocumentId).toBe(locker.id);
		expect(attached.attachedAt).toBeInstanceOf(Date);

		const detached = await permits.attachChecklistDocument({
			permitId: permit.id,
			slotKey: slot.slotKey,
			lockerDocumentId: null,
		});
		expect(detached.lockerDocumentId).toBeNull();
		expect(detached.attachedAt).toBeNull();

		await db.lockerDocument.deleteMany({ where: { id: locker.id } });
	});

	it("404s an unknown lockerDocumentId, not a P2003", async () => {
		const permit = await createPermit();
		const found = await permits.byId(permit.id);
		const slot = found.documents[0];
		if (!slot) throw new Error("expected a scaffolded checklist slot");

		await expectRejects(
			permits.attachChecklistDocument({
				permitId: permit.id,
				slotKey: slot.slotKey,
				lockerDocumentId: "not-a-real-locker-id",
			}),
			NotFoundException,
		);
	});

	it("404s an unknown checklist slot", async () => {
		const permit = await createPermit();
		await expectRejects(
			permits.attachChecklistDocument({
				permitId: permit.id,
				slotKey: "not_a_slot",
				lockerDocumentId: null,
			}),
			NotFoundException,
		);
	});

	it("deleting the locker row leaves the slot's lockerDocumentId null via SetNull", async () => {
		const permit = await createPermit();
		const found = await permits.byId(permit.id);
		const slot = found.documents[0];
		if (!slot) throw new Error("expected a scaffolded checklist slot");

		const locker = await db.lockerDocument.create({
			data: {
				id: `permits-locker-delete-${suffix}`,
				label: "Deletable scan",
				fileName: "deletable.pdf",
				contentType: "application/pdf",
				createdById: userId,
			},
		});

		const attached = await permits.attachChecklistDocument({
			permitId: permit.id,
			slotKey: slot.slotKey,
			lockerDocumentId: locker.id,
		});
		expect(attached.lockerDocumentId).toBe(locker.id);
		expect(attached.attachedAt).toBeInstanceOf(Date);

		await db.lockerDocument.delete({ where: { id: locker.id } });

		const afterDelete = await permits.byId(permit.id);
		const afterSlot = afterDelete.documents.find(
			(doc) => doc.slotKey === slot.slotKey,
		);
		expect(afterSlot?.lockerDocumentId).toBeNull();
	});

	it("404s setInspection when the inspection does not belong to the given permit", async () => {
		const permitA = await createPermit();
		const permitB = await createPermit();
		const foundA = await permits.byId(permitA.id);
		const inspection = foundA.inspections[0];
		if (!inspection) throw new Error("expected a scaffolded inspection");

		await expectRejects(
			permits.setInspection({
				permitId: permitB.id,
				inspectionId: inspection.id,
				name: "Hijacked",
			}),
			NotFoundException,
		);
	});

	it("404s deleteInspection when the inspection does not belong to the given permit", async () => {
		const permitA = await createPermit();
		const permitB = await createPermit();
		const foundA = await permits.byId(permitA.id);
		const inspection = foundA.inspections[0];
		if (!inspection) throw new Error("expected a scaffolded inspection");

		await expectRejects(
			permits.deleteInspection({
				permitId: permitB.id,
				inspectionId: inspection.id,
			}),
			NotFoundException,
		);
	});

	it("rejects lockerRename with an unknown kind", () => {
		const result = lockerRenameInput.safeParse({
			lockerDocumentId: "some-id",
			label: "Renamed",
			kind: "NOT_A_REAL_KIND",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeInstanceOf(z.ZodError);
		}
	});
});

describe("PermitsService.promptState", () => {
	it("is deterministic: no permit, no dismissal, wrong trigger stage means show is false by default", async () => {
		const state = await permits.promptState({ dealId });
		expect(state.show).toBe(false);
		expect(state.neededWhenVerified).toBeNull();
	});

	it("flags an unverified neededWhen fact, and clears the flag once verified", async () => {
		const promptDeal = await db.deal.create({
			data: { name: `Prompt deal ${suffix}`, ownerId: userId, stageId },
			select: { id: true },
		});
		const drawing = await db.drawing.create({
			data: {
				title: "Prompt drawing",
				scene: {},
				address: `123 Main St, Permit City ${suffix}, CO`,
				dealId: promptDeal.id,
				createdById: userId,
			},
			select: { id: true },
		});

		try {
			await playbooks.setFact({
				playbookId,
				factPath: "neededWhen",
				value: "Before framing begins.",
			});

			const unverified = await permits.promptState({ dealId: promptDeal.id });
			expect(unverified.neededWhen).toBe("Before framing begins.");
			expect(unverified.neededWhenVerified).toBe(false);

			await playbooks.verifyFact(
				{ playbookId, factPath: "neededWhen" },
				userId,
			);

			const verified = await permits.promptState({ dealId: promptDeal.id });
			expect(verified.neededWhenVerified).toBe(true);
		} finally {
			await playbooks.clearFact({ playbookId, factPath: "neededWhen" });
			await db.drawing.deleteMany({ where: { id: drawing.id } });
			await db.deal.deleteMany({ where: { id: promptDeal.id } });
		}
	});
});

async function resetDisclaimer(): Promise<void> {
	await db.appSetting.updateMany({
		data: {
			permitDisclaimerVersion: null,
			permitDisclaimerAcceptedById: null,
			permitDisclaimerAcceptedAt: null,
		},
	});
}

describe("PermitsService.worksheetPdf", () => {
	afterAll(resetDisclaimer);

	it("blocks with the first NEEDS_REVIEW answer, naming the count", async () => {
		await resetDisclaimer();
		const permit = await createPermit();
		await permits.applyPrefills({ permitId: permit.id });

		let caught: unknown;
		try {
			await permits.worksheetPdf({ permitId: permit.id });
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
		expect((caught as BadRequestException).message).toMatch(
			/2 fields await review/,
		);
	});

	it("blocks with the first required field missing when nothing has been answered", async () => {
		await resetDisclaimer();
		const permit = await createPermit();

		let caught: unknown;
		try {
			await permits.worksheetPdf({ permitId: permit.id });
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
		expect((caught as BadRequestException).message).toBe(
			"Job name is required.",
		);
	});

	it("blocks on the disclaimer once every field is filled and approved", async () => {
		await resetDisclaimer();
		const permit = await createPermit();
		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Filled job" },
			userId,
		);

		let caught: unknown;
		try {
			await permits.worksheetPdf({ permitId: permit.id });
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
		expect((caught as BadRequestException).message).toBe(
			"Accept the preparation disclaimer first.",
		);
	});

	it("blocks on an old-version disclaimer acceptance", async () => {
		await resetDisclaimer();
		const permit = await createPermit();
		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Filled job" },
			userId,
		);
		await db.appSetting.updateMany({
			data: {
				permitDisclaimerVersion: 0,
				permitDisclaimerAcceptedById: userId,
				permitDisclaimerAcceptedAt: new Date(),
			},
		});

		let caught: unknown;
		try {
			await permits.worksheetPdf({ permitId: permit.id });
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
		expect((caught as BadRequestException).message).toBe(
			"Accept the preparation disclaimer first.",
		);
	});

	it("does not stamp attachedAt when the disk save fails, so the checklist reads Missing", async () => {
		await resetDisclaimer();
		const permit = await createPermit();
		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Filled job" },
			userId,
		);
		await acceptPermitDisclaimerSetting(db, userId, PERMIT_DISCLAIMER_VERSION);

		const blockedPath = join(tmpdir(), `permits-blocked-${suffix}`);
		await writeFile(blockedPath, "not a directory");
		const previousDataDir = process.env.PERMITS_DATA_DIR;
		process.env.PERMITS_DATA_DIR = blockedPath;

		try {
			const result = await permits.worksheetPdf({ permitId: permit.id });
			expect(result.base64.length).toBeGreaterThan(0);
		} finally {
			if (previousDataDir === undefined) {
				delete process.env.PERMITS_DATA_DIR;
			} else {
				process.env.PERMITS_DATA_DIR = previousDataDir;
			}
			await rm(blockedPath, { force: true });
		}

		const slot = await db.permitDocument.findUnique({
			where: {
				permitId_slotKey: { permitId: permit.id, slotKey: "worksheet" },
			},
		});
		expect(slot?.filePath).toBeNull();
		expect(slot?.attachedAt).toBeNull();
	});

	it("renders the PDF and upserts the worksheet document row once every gate passes", async () => {
		await resetDisclaimer();
		const permit = await createPermit();
		await permits.setAnswer(
			{ permitId: permit.id, key: "job_name", value: "Filled job" },
			userId,
		);
		await acceptPermitDisclaimerSetting(db, userId, PERMIT_DISCLAIMER_VERSION);

		const result = await permits.worksheetPdf({ permitId: permit.id });

		expect(result.filename).toMatch(/^\d+-permit-worksheet\.pdf$/);
		expect(result.base64.length).toBeGreaterThan(0);
		const bytes = Buffer.from(result.base64, "base64");
		expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

		const slot = await db.permitDocument.findUnique({
			where: {
				permitId_slotKey: { permitId: permit.id, slotKey: "worksheet" },
			},
		});
		expect(slot).not.toBeNull();
		expect(slot?.label).toBe("Application worksheet");
		expect(slot?.attachedAt).toBeInstanceOf(Date);

		const again = await permits.worksheetPdf({ permitId: permit.id });
		expect(again.filename).toBe(result.filename);
		const stillOneSlot = await db.permitDocument.findMany({
			where: { permitId: permit.id, slotKey: "worksheet" },
		});
		expect(stillOneSlot).toHaveLength(1);
	});
});
