import { db } from "@crm/db";
import {
	PHOTO_ID_PATTERN,
	PHOTO_VARIANTS,
	type PhotoVariant,
	readPhotoFile,
} from "@crm/db/photo-files";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ photoId: string; variant: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}
	const { photoId, variant } = await params;
	if (!PHOTO_ID_PATTERN.test(photoId)) {
		return NextResponse.json({ error: "Invalid photoId." }, { status: 400 });
	}
	if (!PHOTO_VARIANTS.includes(variant as PhotoVariant)) {
		return NextResponse.json({ error: "Invalid variant." }, { status: 400 });
	}
	const photo = await db.photo.findUnique({
		where: { id: photoId },
		select: { id: true },
	});
	if (!photo) {
		return NextResponse.json({ error: "The photo was not found." }, { status: 404 });
	}
	const bytes = await readPhotoFile(photoId, variant as PhotoVariant);
	if (!bytes) {
		return NextResponse.json({ error: "The photo file is missing." }, { status: 404 });
	}
	return new NextResponse(new Uint8Array(bytes), {
		headers: {
			"content-type": "image/jpeg",
			"cache-control": "private, max-age=31536000, immutable",
		},
	});
}
