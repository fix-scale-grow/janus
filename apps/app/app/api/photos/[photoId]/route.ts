import { db } from "@crm/db";
import { PHOTO_ID_PATTERN, removePhotoFiles } from "@crm/db/photo-files";
import { NextResponse } from "next/server";
import { photoVisible, routePrincipal } from "@/lib/access-route";
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
	const p = await routePrincipal(session.user.id);
	if (!p || !(await photoVisible(p, photoId, "DELETE"))) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	await db.photo.delete({ where: { id: photoId } });
	await removePhotoFiles(photoId);
	return NextResponse.json({ ok: true });
}
