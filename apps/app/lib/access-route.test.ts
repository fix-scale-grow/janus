import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { noAccessPrincipal } from "@crm/db/access-policy";
import {
	agentRecordsVisible,
	costVisible,
	drawingVisible,
	janusChatAllowed,
	permitDocumentVisible,
	photoVisible,
} from "./access-route";

const suffix = process.env.TEST_RUN_ID ?? "access-route";

let f: AccessFixture;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
});

afterAll(async () => {
	await f.cleanup();
});

describe("photoVisible", () => {
	test("clerk sees their own deal's photo", async () => {
		expect(await photoVisible(f.clerk, f.clerkPhotoId)).toBe(true);
	});

	test("clerk cannot see another deal's photo", async () => {
		expect(await photoVisible(f.clerk, f.otherPhotoId)).toBe(false);
	});

	test("admin sees any photo", async () => {
		expect(await photoVisible(f.admin, f.otherPhotoId)).toBe(true);
	});

	test("a photo on a contact-only anchor is out of scope for the clerk", async () => {
		expect(
			await photoVisible(f.clerk, f.contactOnlyPhotoOnOtherContactId),
		).toBe(false);
	});
});

describe("costVisible", () => {
	test("crew cannot view cost money", async () => {
		expect(await costVisible(f.crew, f.clerkCostId, "view")).toBe(false);
	});

	test("admin can view any in-scope cost", async () => {
		expect(await costVisible(f.admin, f.otherCostId, "view")).toBe(true);
	});

	test("a jobCosts.submit-only principal can submit but not view", async () => {
		const submitOnly = {
			...noAccessPrincipal(f.clerkId),
			scope: "ALL" as const,
			policy: {
				...noAccessPrincipal(f.clerkId).policy,
				actions: ["jobCosts.submit" as const],
			},
		};

		expect(await costVisible(submitOnly, f.clerkCostId, "submit")).toBe(true);
		expect(await costVisible(submitOnly, f.clerkCostId, "view")).toBe(false);
	});
});

describe("drawingVisible", () => {
	test("clerk sees their own deal's drawing", async () => {
		expect(await drawingVisible(f.clerk, f.clerkDrawingId, "VIEW")).toBe(true);
	});

	test("clerk cannot see another deal's drawing", async () => {
		expect(await drawingVisible(f.clerk, f.otherDrawingId, "VIEW")).toBe(false);
	});
});

describe("permitDocumentVisible", () => {
	test("admin sees a permit document on any deal", async () => {
		const document = await db.permitDocument.create({
			data: {
				permitId: f.otherPermitId,
				slotKey: `slot-${suffix}`,
				label: "Test slot",
			},
			select: { id: true },
		});

		expect(await permitDocumentVisible(f.admin, document.id, "VIEW")).toBe(
			true,
		);
		expect(await permitDocumentVisible(f.clerk, document.id, "VIEW")).toBe(
			false,
		);

		await db.permitDocument.delete({ where: { id: document.id } });
	});
});

describe("janusChatAllowed", () => {
	test("an admin and a grouped office member may chat", () => {
		expect(janusChatAllowed(f.admin)).toBe(true);
		expect(janusChatAllowed(f.office)).toBe(true);
		expect(janusChatAllowed(f.clerk)).toBe(true);
	});

	test("a field-surface group, an ungrouped member and a non-member may not", () => {
		expect(janusChatAllowed(f.crew)).toBe(false);
		expect(janusChatAllowed(noAccessPrincipal(f.clerkId))).toBe(false);
		expect(janusChatAllowed(null)).toBe(false);
	});
});

describe("agentRecordsVisible", () => {
	test("a clerk may open Janus on their own records", async () => {
		expect(
			await agentRecordsVisible(f.clerk, {
				contactId: f.clerkContactId,
				dealId: f.clerkDealId,
				drawingId: f.clerkDrawingId,
			}),
		).toBe(true);
		expect(await agentRecordsVisible(f.clerk, {})).toBe(true);
	});

	test("a clerk may not open Janus on another rep's record", async () => {
		expect(
			await agentRecordsVisible(f.clerk, { contactId: f.otherContactId }),
		).toBe(false);
		expect(await agentRecordsVisible(f.clerk, { dealId: f.otherDealId })).toBe(
			false,
		);
		expect(
			await agentRecordsVisible(f.clerk, { drawingId: f.otherDrawingId }),
		).toBe(false);
	});
});

describe("FIELD surface on office documents", () => {
	test("a FIELD principal cannot open a drawing it could otherwise see", async () => {
		const field = { ...f.clerk, surface: "FIELD" as const };
		expect(await drawingVisible(f.clerk, f.clerkDrawingId, "VIEW")).toBe(true);
		expect(await drawingVisible(field, f.clerkDrawingId, "VIEW")).toBe(false);
	});

	test("a FIELD principal cannot open a permit document", async () => {
		const document = await db.permitDocument.create({
			data: {
				permitId: f.clerkPermitId,
				slotKey: `field-slot-${suffix}`,
				label: "Field slot",
			},
			select: { id: true },
		});
		const field = { ...f.office, surface: "FIELD" as const };
		const full = await permitDocumentVisible(f.office, document.id, "VIEW");
		const onField = await permitDocumentVisible(field, document.id, "VIEW");
		await db.permitDocument.delete({ where: { id: document.id } });
		expect(full).toBe(true);
		expect(onField).toBe(false);
	});

	test("a FIELD principal still reaches photos for close-out", async () => {
		const field = { ...f.clerk, surface: "FIELD" as const };
		expect(await photoVisible(field, f.clerkPhotoId)).toBe(true);
	});
});
