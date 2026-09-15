import { db } from "@crm/db";
import { NextResponse } from "next/server";
import { permitDocumentVisible, routePrincipal } from "@/lib/access-route";
import { COST_ID_PATTERN } from "@/lib/cost-receipts";
import { contentTypeFor, readPermitFile } from "@/lib/permit-files";
import { getSession } from "@/lib/session";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ documentId: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const { documentId } = await params;
	if (!COST_ID_PATTERN.test(documentId)) {
		return NextResponse.json(
			{ error: "Invalid documentId." },
			{
				status: 400,
			},
		);
	}

	const p = await routePrincipal(session.user.id);
	if (!p || !(await permitDocumentVisible(p, documentId, "VIEW"))) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const document = await db.permitDocument.findUnique({
		where: { id: documentId },
		select: { filePath: true },
	});
	if (!document?.filePath) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const bytes = await readPermitFile(document.filePath);
	if (!bytes) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	return new NextResponse(new Uint8Array(bytes), {
		headers: {
			"content-type": contentTypeFor(document.filePath),
			"cache-control": "private, max-age=31536000, immutable",
		},
	});
}
