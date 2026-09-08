import { NextResponse } from "next/server";
import { readLogo } from "@/lib/workspace-logo";

export async function GET(): Promise<Response> {
	const logo = await readLogo();
	if (!logo) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const headers: Record<string, string> = {
		"content-type": logo.contentType,
		"cache-control": "public, max-age=31536000, immutable",
	};

	if (logo.contentType === "image/svg+xml") {
		headers["content-security-policy"] = "script-src 'none'; sandbox";
	}

	return new NextResponse(new Uint8Array(logo.bytes), { headers });
}
