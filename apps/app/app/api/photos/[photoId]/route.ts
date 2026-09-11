import { db } from "@crm/db";
import { PHOTO_ID_PATTERN, removePhotoFiles } from "@crm/db/photo-files";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}
	const { photoId } = await params;
	if (!PHOTO_ID_PATTERN.test(photoId)) {
		return NextResponse.json({ error: "Invalid photoId." }, { status: 400 });
	}
	const photo = await db.photo.findUnique({
		where: { id: photoId },
		select: { id: true },
	});
	if (!photo) {
		return NextResponse.json({ error: "The photo was not found." }, { status: 404 });
	}
	await db.photo.delete({ where: { id: photoId } });
	await removePhotoFiles(photoId);
	return NextResponse.json({ ok: true });
}
