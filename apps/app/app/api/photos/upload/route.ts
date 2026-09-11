import { db } from "@crm/db";
import {
	PHOTO_MAX_BYTES,
	PHOTO_THUMB_MAX_BYTES,
	photoUrl,
	removePhotoFiles,
	savePhotoFiles,
} from "@crm/db/photo-files";
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { matchesDeclaredType } from "@/lib/workspace-logo";

export async function POST(request: NextRequest) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const formData = await request.formData();
	const master = formData.get("master");
	const thumb = formData.get("thumb");
	const dealId = formData.get("dealId");
	const contactId = formData.get("contactId");
	const filename = formData.get("filename");
	const width = Number(formData.get("width"));
	const height = Number(formData.get("height"));
	const takenAtRaw = formData.get("takenAt");

	if (!(master instanceof Blob) || !(thumb instanceof Blob)) {
		return NextResponse.json({ error: "Missing image data." }, { status: 400 });
	}
	if (typeof filename !== "string" || filename.trim().length === 0) {
		return NextResponse.json({ error: "Missing filename." }, { status: 400 });
	}
	if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
		return NextResponse.json({ error: "Missing image dimensions." }, { status: 400 });
	}
	if (master.size > PHOTO_MAX_BYTES || thumb.size > PHOTO_THUMB_MAX_BYTES) {
		return NextResponse.json({ error: "The photo is too large." }, { status: 413 });
	}
	if (typeof dealId !== "string" && typeof contactId !== "string") {
		return NextResponse.json({ error: "A photo needs a deal or a contact." }, { status: 400 });
	}

	if (typeof dealId === "string") {
		const deal = await db.deal.findUnique({ where: { id: dealId }, select: { id: true } });
		if (!deal) return NextResponse.json({ error: "The deal was not found." }, { status: 404 });
	}
	if (typeof contactId === "string") {
		const contact = await db.contact.findUnique({ where: { id: contactId }, select: { id: true } });
		if (!contact) return NextResponse.json({ error: "The contact was not found." }, { status: 404 });
	}

	const masterBytes = Buffer.from(await master.arrayBuffer());
	const thumbBytes = Buffer.from(await thumb.arrayBuffer());
	if (
		!matchesDeclaredType("image/jpeg", masterBytes) ||
		!matchesDeclaredType("image/jpeg", thumbBytes)
	) {
		return NextResponse.json({ error: "Photos must be JPEG images." }, { status: 415 });
	}

	const takenAt =
		typeof takenAtRaw === "string" && Number.isFinite(Number(takenAtRaw))
			? new Date(Number(takenAtRaw))
			: null;

	const photo = await db.photo.create({
		data: {
			dealId: typeof dealId === "string" ? dealId : null,
			contactId: typeof contactId === "string" ? contactId : null,
			uploadedById: session.user.id,
			filename: filename.trim().slice(0, 300),
			mimeType: "image/jpeg",
			sizeBytes: masterBytes.length,
			width,
			height,
			takenAt,
		},
	});

	const saved = await savePhotoFiles(photo.id, masterBytes, thumbBytes);
	if (!saved) {
		await removePhotoFiles(photo.id);
		await db.photo.delete({ where: { id: photo.id } }).catch(() => null);
		return NextResponse.json({ error: "The photo could not be saved." }, { status: 500 });
	}

	return NextResponse.json(
		{ id: photo.id, thumbUrl: photoUrl(photo.id, "thumb") },
		{ status: 201 },
	);
}
