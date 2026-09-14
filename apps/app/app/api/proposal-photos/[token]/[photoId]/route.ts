import { db } from "@crm/db";
import { PHOTO_ID_PATTERN, readPhotoFile } from "@crm/db/photo-files";
import { NextResponse } from "next/server";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ token: string; photoId: string }> },
): Promise<Response> {
	const { token, photoId } = await params;
	if (!TOKEN_PATTERN.test(token) || !PHOTO_ID_PATTERN.test(photoId)) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const proposal = await db.proposal.findUnique({
		where: { viewToken: token },
		select: { status: true, tokenExpiresAt: true, estimateId: true },
	});
	if (
		!proposal ||
		proposal.status === "DRAFT" ||
		proposal.status === "VOID" ||
		!proposal.tokenExpiresAt ||
		proposal.tokenExpiresAt < new Date()
	) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const link = await db.estimatePhoto.findUnique({
		where: {
			estimateId_photoId: { estimateId: proposal.estimateId, photoId },
		},
		select: { id: true },
	});
	if (!link) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const bytes = await readPhotoFile(photoId, "master");
	if (!bytes) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	return new NextResponse(new Uint8Array(bytes), {
		headers: {
			"content-type": "image/jpeg",
			"cache-control": "private, max-age=300",
		},
	});
}
