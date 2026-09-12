import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { savePhotoFiles } from "@crm/db/photo-files";
import { PhotosService } from "../src/photos/photos.service";

const suffix = process.env.TEST_RUN_ID ?? "photos-spec";

const service = new PhotosService(db);

const JPEG_BYTES = Buffer.from([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
	0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

let photosDataDir: string;

async function expectRejects(
	promise: Promise<unknown>,
	match?: RegExp,
): Promise<void> {
	let caught: unknown;

	try {
		await promise;
	} catch (error) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(Error);
	if (match) expect((caught as Error).message).toMatch(match);
}

let userId: string;
let dealId: string;
let contactId: string;
let estimateId: string;
let invoiceId: string;
let projectId: string;

beforeAll(async () => {
	photosDataDir = await mkdtemp(join(tmpdir(), "photos-pdf-"));
	process.env.PHOTOS_DATA_DIR = photosDataDir;

	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: "Test",
			slug: `ws-${suffix}`,
			createdAt: new Date(),
		},
	});

	const user = await db.user.create({
		data: {
			id: `photos-user-${suffix}`,
			name: "Photos User",
			email: `photos-user-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	await db.member.create({
		data: {
			id: `photos-member-row-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId,
			role: "admin",
			createdAt: new Date(),
		},
	});

	const seededStage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});

	const deal = await db.deal.create({
		data: {
			id: `photos-deal-${suffix}`,
			name: `Photos Deal ${suffix}`,
			ownerId: userId,
			currency: "USD",
			stageId: seededStage.id,
		},
		select: { id: true },
	});
	dealId = deal.id;

	const contact = await db.contact.create({
		data: {
			id: `photos-contact-${suffix}`,
			firstName: "Photos",
			lastName: `Contact ${suffix}`,
		},
		select: { id: true },
	});
	contactId = contact.id;

	const estimate = await db.estimate.create({
		data: {
			id: `photos-estimate-${suffix}`,
			title: `Photos Estimate ${suffix}`,
			dealId,
			createdById: userId,
		},
		select: { id: true },
	});
	estimateId = estimate.id;

	const invoice = await db.invoice.create({
		data: {
			id: `photos-invoice-${suffix}`,
			status: "DRAFT",
			currency: "USD",
			dealId,
			createdById: userId,
		},
		select: { id: true },
	});
	invoiceId = invoice.id;

	const project = await db.project.create({
		data: {
			id: `photos-project-${suffix}`,
			name: `Photos Project ${suffix}`,
			startDate: new Date(),
			dealId,
			createdById: userId,
			status: "ACTIVE",
		},
		select: { id: true },
	});
	projectId = project.id;
});

afterAll(async () => {
	await db.estimatePhoto.deleteMany({ where: { estimateId } });
	await db.invoicePhoto.deleteMany({ where: { invoiceId } });
	await db.projectPhoto.deleteMany({ where: { projectId } });
	await db.photo.deleteMany({ where: { dealId } });
	await db.photo.deleteMany({ where: { contactId } });
	await db.estimate.deleteMany({ where: { id: estimateId } });
	await db.invoiceLineItem.deleteMany({ where: { invoiceId } });
	await db.invoice.deleteMany({ where: { id: invoiceId } });
	await db.project.deleteMany({ where: { id: projectId } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.member.deleteMany({ where: { userId } });
	await db.user.deleteMany({ where: { id: userId } });
	delete process.env.PHOTOS_DATA_DIR;
	await rm(photosDataDir, { recursive: true, force: true });
});

describe("PhotosService", () => {
	it("lists photos scoped to a deal, newest first", async () => {
		const older = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `older-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
			},
			select: { id: true },
		});
		const newer = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `newer-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			select: { id: true },
		});
		await db.photo.create({
			data: {
				contactId,
				uploadedById: userId,
				filename: `contact-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		const result = await service.list({ dealId });

		expect(result.total).toBe(2);
		expect(result.rows.map((row) => row.id)).toEqual([newer.id, older.id]);
	});

	it("lists photos scoped to a contact", async () => {
		const result = await service.list({ contactId });

		expect(result.total).toBe(1);
		expect(result.rows[0]?.filename).toBe(`contact-${suffix}.jpg`);
	});

	it("includes the deal's contacts' photos when asked", async () => {
		await db.dealContact.create({ data: { dealId, contactId } });

		const withContacts = await service.list({
			dealId,
			includeDealContacts: true,
		});
		const dealOnly = await service.list({ dealId });

		expect(withContacts.total).toBe(3);
		expect(
			withContacts.rows.some(
				(row) => row.filename === `contact-${suffix}.jpg`,
			),
		).toBe(true);
		expect(dealOnly.total).toBe(2);

		await db.dealContact.delete({
			where: { dealId_contactId: { dealId, contactId } },
		});
	});

	it("links a photo to an estimate idempotently", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `link-a-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkEstimate({ estimateId, photoId: photo.id });
		await service.linkEstimate({ estimateId, photoId: photo.id });

		const links = await service.forEstimate(estimateId);

		expect(links.length).toBe(1);
		expect(links[0]?.sortOrder).toBe(0);
	});

	it("appends new links after existing ones", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `link-b-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkEstimate({ estimateId, photoId: photo.id });

		const links = await service.forEstimate(estimateId);
		const linked = links.find((link) => link.photoId === photo.id);

		expect(linked?.sortOrder).toBe(1);
	});

	it("rejects linking a missing photo", async () => {
		await expectRejects(
			service.linkEstimate({
				estimateId,
				photoId: "clnopeaaaaaaaaaaaaaaaa",
			}),
			/photo/i,
		);
	});

	it("sets the pdf flag", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `flag-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkEstimate({ estimateId, photoId: photo.id });
		await service.setEstimatePdfFlag({
			estimateId,
			photoId: photo.id,
			includeInPdf: true,
		});

		const links = await service.forEstimate(estimateId);
		const linked = links.find((link) => link.photoId === photo.id);

		expect(linked?.includeInPdf).toBe(true);
	});

	it("reorders with the exact set and rejects a partial set", async () => {
		const before = await service.forEstimate(estimateId);
		const ids = before.map((link) => link.photoId);
		const reversed = [...ids].reverse();

		await service.reorderEstimatePhotos({
			estimateId,
			photoIds: reversed,
		});

		const after = await service.forEstimate(estimateId);

		expect(after.map((link) => link.photoId)).toEqual(reversed);

		await expectRejects(
			service.reorderEstimatePhotos({
				estimateId,
				photoIds: reversed.slice(1),
			}),
			/photo/i,
		);
	});

	it("unlinks without deleting the photo", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `unlink-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkEstimate({ estimateId, photoId: photo.id });
		await service.unlinkEstimate({ estimateId, photoId: photo.id });

		const links = await service.forEstimate(estimateId);
		expect(links.some((link) => link.photoId === photo.id)).toBe(false);

		const stillThere = await db.photo.findUnique({ where: { id: photo.id } });
		expect(stillThere).not.toBeNull();
	});

	it("links a photo to an invoice idempotently", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `invoice-link-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkInvoice({ invoiceId, photoId: photo.id });
		await service.linkInvoice({ invoiceId, photoId: photo.id });

		const links = await service.forInvoice(invoiceId);
		const linked = links.filter((link) => link.photoId === photo.id);

		expect(linked.length).toBe(1);
	});

	it("sets the invoice pdf flag", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `invoice-flag-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkInvoice({ invoiceId, photoId: photo.id });
		await service.setInvoicePdfFlag({
			invoiceId,
			photoId: photo.id,
			includeInPdf: true,
		});

		const links = await service.forInvoice(invoiceId);
		const linked = links.find((link) => link.photoId === photo.id);

		expect(linked?.includeInPdf).toBe(true);
	});

	it("rejects an invoice reorder with a partial set", async () => {
		const before = await service.forInvoice(invoiceId);
		const ids = before.map((link) => link.photoId);

		await expectRejects(
			service.reorderInvoicePhotos({
				invoiceId,
				photoIds: ids.slice(1),
			}),
			/photo/i,
		);
	});

	it("links a project photo with the default stage BEFORE", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `project-link-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkProject({ projectId, photoId: photo.id });

		const links = await service.forProject(projectId);
		const linked = links.find((link) => link.photoId === photo.id);

		expect(linked?.stageLabel).toBe("BEFORE");
	});

	it("sets the project photo stage to IN_PROGRESS", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `project-stage-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkProject({ projectId, photoId: photo.id });
		await service.setProjectStage({
			projectId,
			photoId: photo.id,
			stageLabel: "IN_PROGRESS",
		});

		const links = await service.forProject(projectId);
		const linked = links.find((link) => link.photoId === photo.id);

		expect(linked?.stageLabel).toBe("IN_PROGRESS");
	});

	it("unlinks a project photo without deleting the photo", async () => {
		const photo = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `project-unlink-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: 10,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkProject({ projectId, photoId: photo.id });
		await service.unlinkProject({ projectId, photoId: photo.id });

		const links = await service.forProject(projectId);
		expect(links.some((link) => link.photoId === photo.id)).toBe(false);

		const stillThere = await db.photo.findUnique({ where: { id: photo.id } });
		expect(stillThere).not.toBeNull();
	});

	it("returns only pdf-flagged estimate photos in sort order", async () => {
		const flaggedFirst = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `pdf-flagged-first-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: JPEG_BYTES.length,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});
		const flaggedSecond = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `pdf-flagged-second-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: JPEG_BYTES.length,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});
		const unflagged = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `pdf-unflagged-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: JPEG_BYTES.length,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await savePhotoFiles(flaggedFirst.id, JPEG_BYTES, JPEG_BYTES);
		await savePhotoFiles(flaggedSecond.id, JPEG_BYTES, JPEG_BYTES);
		await savePhotoFiles(unflagged.id, JPEG_BYTES, JPEG_BYTES);

		const existing = await service.forEstimate(estimateId);
		const existingIds = existing.map((link) => link.photoId);

		await service.linkEstimate({ estimateId, photoId: flaggedSecond.id });
		await service.linkEstimate({ estimateId, photoId: flaggedFirst.id });
		await service.linkEstimate({ estimateId, photoId: unflagged.id });

		await service.reorderEstimatePhotos({
			estimateId,
			photoIds: [
				flaggedSecond.id,
				flaggedFirst.id,
				unflagged.id,
				...existingIds,
			],
		});
		await service.setEstimatePdfFlag({
			estimateId,
			photoId: flaggedSecond.id,
			includeInPdf: true,
		});
		await service.setEstimatePdfFlag({
			estimateId,
			photoId: flaggedFirst.id,
			includeInPdf: true,
		});

		const photos = await service.pdfPhotosForEstimate(estimateId);

		expect(photos.length).toBe(2);
		expect(photos[0]?.filename).toBe(`pdf-flagged-second-${suffix}.jpg`);
		expect(photos[1]?.filename).toBe(`pdf-flagged-first-${suffix}.jpg`);
		for (const photo of photos) {
			expect(photo.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
		}
	});

	it("skips a flagged photo whose file is missing", async () => {
		const missing = await db.photo.create({
			data: {
				dealId,
				uploadedById: userId,
				filename: `pdf-missing-${suffix}.jpg`,
				mimeType: "image/jpeg",
				sizeBytes: JPEG_BYTES.length,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});

		await service.linkInvoice({ invoiceId, photoId: missing.id });
		await service.setInvoicePdfFlag({
			invoiceId,
			photoId: missing.id,
			includeInPdf: true,
		});

		const photos = await service.pdfPhotosForInvoice(invoiceId);

		expect(photos).toEqual([]);
	});
});
