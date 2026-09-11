import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { PhotosService } from "../src/photos/photos.service";

const suffix = process.env.TEST_RUN_ID ?? "photos-spec";

const service = new PhotosService(db);

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
});

afterAll(async () => {
	await db.estimatePhoto.deleteMany({ where: { estimateId } });
	await db.photo.deleteMany({ where: { dealId } });
	await db.estimate.deleteMany({ where: { id: estimateId } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.member.deleteMany({ where: { userId } });
	await db.user.deleteMany({ where: { id: userId } });
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
});
