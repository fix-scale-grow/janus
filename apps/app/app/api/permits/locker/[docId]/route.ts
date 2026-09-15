import { db } from "@crm/db";
import { allows } from "@crm/db/access-policy";
import { NextResponse } from "next/server";
import { routePrincipal } from "@/lib/access-route";
import { COST_ID_PATTERN } from "@/lib/cost-receipts";
import {
	contentTypeFor,
	readLockerFile,
	removeLockerFile,
} from "@/lib/permit-files";
import { getSession } from "@/lib/session";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ docId: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const { docId } = await params;
	if (!COST_ID_PATTERN.test(docId)) {
		return NextResponse.json({ error: "Invalid docId." }, { status: 400 });
	}

	const p = await routePrincipal(session.user.id);
	if (!p || !allows(p, "permits", "VIEW")) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const locker = await db.lockerDocument.findUnique({
		where: { id: docId },
		select: { fileName: true, contentType: true },
	});
	if (!locker?.fileName) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const bytes = await readLockerFile(locker.fileName);
	if (!bytes) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	return new NextResponse(new Uint8Array(bytes), {
		headers: {
			"content-type": locker.contentType || contentTypeFor(locker.fileName),
			"cache-control": "private, max-age=31536000, immutable",
		},
	});
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ docId: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const { docId } = await params;
	if (!COST_ID_PATTERN.test(docId)) {
		return NextResponse.json({ error: "Invalid docId." }, { status: 400 });
	}

	const p = await routePrincipal(session.user.id);
	if (!p || !allows(p, "permits", "EDIT")) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const locker = await db.lockerDocument.findUnique({
		where: { id: docId },
		select: { fileName: true },
	});
	if (!locker) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	if (locker.fileName) {
		await removeLockerFile(locker.fileName);
	}
	await db.lockerDocument.delete({ where: { id: docId } });

	return NextResponse.json({ ok: true });
}
