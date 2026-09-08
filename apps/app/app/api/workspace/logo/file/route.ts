import { NextResponse } from "next/server";
import { readLogo } from "@/lib/workspace-logo";

export async function GET(): Promise<Response> {
	const logo = await readLogo();
	if (!logo) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	return new NextResponse(new Uint8Array(logo.bytes), {
		headers: {
			"content-type": logo.contentType,
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
}
