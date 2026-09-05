import { NextResponse } from "next/server";
import { readThumbnail } from "@/lib/drawing-thumbnails";
import { getSession } from "@/lib/session";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ drawingId: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const { drawingId } = await params;
	const bytes = await readThumbnail(drawingId);
	if (!bytes) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	return new NextResponse(new Uint8Array(bytes), {
		headers: {
			"content-type": "image/png",
			"cache-control": "private, max-age=31536000, immutable",
		},
	});
}
