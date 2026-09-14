import { db } from "@crm/db";
import { NextResponse } from "next/server";
import { COST_ID_PATTERN } from "@/lib/cost-receipts";
import {
	PERMIT_FILE_TYPES,
	removePermitFile,
	savePermitFile,
} from "@/lib/permit-files";
import { getSession } from "@/lib/session";

const PERMIT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get("file");
	const permitId = formData.get("permitId");
	const slotKey = formData.get("slotKey");

	if (
		!(file instanceof Blob) ||
		typeof permitId !== "string" ||
		!permitId ||
		typeof slotKey !== "string" ||
		!slotKey
	) {
		return NextResponse.json(
			{ error: "A file, permitId and slotKey are required." },
			{ status: 400 },
		);
	}

	if (!COST_ID_PATTERN.test(permitId)) {
		return NextResponse.json({ error: "Invalid permitId." }, { status: 400 });
	}

	const ext = PERMIT_FILE_TYPES[file.type];
	if (!ext) {
		return NextResponse.json(
			{ error: "The file must be a PNG, JPEG, WebP or PDF." },
			{ status: 400 },
		);
	}

	if (file.size > PERMIT_DOCUMENT_MAX_BYTES) {
		return NextResponse.json(
			{ error: "The file is too large." },
			{
				status: 413,
			},
		);
	}

	const slot = await db.permitDocument.findUnique({
		where: { permitId_slotKey: { permitId, slotKey } },
		select: { id: true, filePath: true },
	});
	if (!slot) {
		return NextResponse.json(
			{ error: "No checklist slot found." },
			{
				status: 404,
			},
		);
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	const fileName = await savePermitFile(slot.id, ext, bytes);
	if (!fileName) {
		return NextResponse.json(
			{ error: "The file could not be saved." },
			{ status: 500 },
		);
	}

	try {
		await db.permitDocument.update({
			where: { id: slot.id },
			data: { filePath: fileName, attachedAt: new Date() },
		});
	} catch {
		try {
			await removePermitFile(fileName);
		} catch {}
		return NextResponse.json(
			{ error: "The file could not be saved." },
			{ status: 500 },
		);
	}

	if (slot.filePath && slot.filePath !== fileName) {
		try {
			await removePermitFile(slot.filePath);
		} catch {}
	}

	return NextResponse.json({
		url: `/api/permits/document/${slot.id}?v=${Date.now()}`,
	});
}
