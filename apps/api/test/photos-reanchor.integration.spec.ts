import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { PhotosService } from "../src/photos/photos.service";

const suffix = process.env.TEST_RUN_ID ?? "reanchor-spec";

const photos = new PhotosService(db);

let userId: string;
let contactId: string;
let dealId: string;
let stageId: string;

async function createAnchorlessPhoto(id: string) {
	return db.photo.create({
		data: {
			id,
			uploadedById: userId,
			filename: "site.jpg",
			mimeType: "image/jpeg",
			sizeBytes: 1000,
			width: 100,
			height: 100,
		},
		select: { id: true },
	});
}

beforeAll(async () => {
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
			id: `reanchor-user-${suffix}`,
			name: "Reanchor User",
			email: `reanchor-user-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	const contact = await db.contact.create({
		data: {
			id: `reanchor-contact-${suffix}`,
			firstName: "Rea",
			lastName: "Anchor",
		},
		select: { id: true },
	});
	contactId = contact.id;

	const stage = await db.stage.findFirstOrThrow({
		where: { outcome: "OPEN" },
		select: { id: true },
	});
	stageId = stage.id;

	const deal = await db.deal.create({
		data: {
			id: `reanchor-deal-${suffix}`,
			name: `Reanchor Deal ${suffix}`,
			ownerId: userId,
			currency: "USD",
			stageId,
		},
		select: { id: true },
	});
	dealId = deal.id;
});

afterAll(async () => {
	await db.estimatePhoto.deleteMany({
		where: { photoId: { startsWith: `reanchor-photo-` } },
	});
	await db.invoicePhoto.deleteMany({
		where: { photoId: { startsWith: `reanchor-photo-` } },
	});
	await db.photo.deleteMany({
		where: { id: { startsWith: "reanchor-photo-" } },
	});
	await db.estimate.deleteMany({
		where: { id: { startsWith: "reanchor-estimate-" } },
	});
	await db.invoice.deleteMany({ where: { notes: `reanchor-${suffix}` } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("PhotosService re-anchoring", () => {
	it("anchors estimate-linked photos to a contact", async () => {
		const estimate = await db.estimate.create({
			data: {
				id: `reanchor-estimate-a-${suffix}`,
				title: "Standalone",
				createdById: userId,
			},
			select: { id: true },
		});
		const photo = await createAnchorlessPhoto(`reanchor-photo-a-${suffix}`);
		await db.estimatePhoto.create({
			data: { estimateId: estimate.id, photoId: photo.id },
		});

		await photos.reanchorForEstimate(estimate.id, { contactId });

		const updated = await db.photo.findUniqueOrThrow({
			where: { id: photo.id },
			select: { contactId: true, dealId: true },
		});
		expect(updated.contactId).toBe(contactId);
		expect(updated.dealId).toBeNull();
	});

	it("prefers the deal over the contact and skips anchored photos", async () => {
		const estimate = await db.estimate.create({
			data: {
				id: `reanchor-estimate-b-${suffix}`,
				title: "Standalone B",
				createdById: userId,
			},
			select: { id: true },
		});
		const loose = await createAnchorlessPhoto(`reanchor-photo-b-${suffix}`);
		const owned = await db.photo.create({
			data: {
				id: `reanchor-photo-c-${suffix}`,
				contactId,
				uploadedById: userId,
				filename: "owned.jpg",
				mimeType: "image/jpeg",
				sizeBytes: 1000,
				width: 100,
				height: 100,
			},
			select: { id: true },
		});
		await db.estimatePhoto.createMany({
			data: [
				{ estimateId: estimate.id, photoId: loose.id },
				{ estimateId: estimate.id, photoId: owned.id },
			],
		});

		await photos.reanchorForEstimate(estimate.id, { dealId, contactId });

		const looseRow = await db.photo.findUniqueOrThrow({
			where: { id: loose.id },
			select: { dealId: true, contactId: true },
		});
		expect(looseRow.dealId).toBe(dealId);
		expect(looseRow.contactId).toBeNull();

		const ownedRow = await db.photo.findUniqueOrThrow({
			where: { id: owned.id },
			select: { dealId: true, contactId: true },
		});
		expect(ownedRow.dealId).toBeNull();
		expect(ownedRow.contactId).toBe(contactId);
	});

	it("anchors invoice-linked photos to a contact", async () => {
		const invoice = await db.invoice.create({
			data: { createdById: userId, notes: `reanchor-${suffix}` },
			select: { id: true },
		});
		const photo = await createAnchorlessPhoto(`reanchor-photo-d-${suffix}`);
		await db.invoicePhoto.create({
			data: { invoiceId: invoice.id, photoId: photo.id },
		});

		await photos.reanchorForInvoice(invoice.id, { contactId });

		const updated = await db.photo.findUniqueOrThrow({
			where: { id: photo.id },
			select: { contactId: true },
		});
		expect(updated.contactId).toBe(contactId);
	});
});
