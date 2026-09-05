import { blobEnabled, putBytes } from "@crm/db/blob";
import { DRAWINGS } from "@crm/drawings";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: Request): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	if (!blobEnabled()) {
		return NextResponse.json({ url: null });
	}

	const formData = await request.formData();
	const file = formData.get("file");
	const drawingId = formData.get("drawingId");

	if (!(file instanceof Blob) || typeof drawingId !== "string" || !drawingId) {
		return NextResponse.json(
			{ error: "A file and drawingId are required." },
			{ status: 400 },
		);
	}

	if (file.type !== "image/png") {
		return NextResponse.json(
			{ error: "The thumbnail must be a PNG." },
			{ status: 400 },
		);
	}

	if (file.size > DRAWINGS.thumbnail.maxBytes) {
		return NextResponse.json(
			{ error: "The thumbnail is too large." },
			{ status: 413 },
		);
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	const url = await putBytes(
		bytes,
		`drawings/${drawingId}-thumb.png`,
		"image/png",
	);

	return NextResponse.json({ url });
}
