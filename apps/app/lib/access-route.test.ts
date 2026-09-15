import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { noAccessPrincipal } from "@crm/db/access-policy";
import {
	costVisible,
	drawingVisible,
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
