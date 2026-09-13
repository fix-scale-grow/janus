import { db } from "@crm/db";
import { NextResponse } from "next/server";
import {
	PERMIT_FILE_TYPES,
	removeLockerFile,
	saveLockerFile,
} from "@/lib/permit-files";
import { getSession } from "@/lib/session";

const LOCKER_FILE_MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get("file");
	const label = formData.get("label");
	const kind = formData.get("kind");

	if (!(file instanceof Blob) || typeof label !== "string" || !label.trim()) {
		return NextResponse.json(
			{ error: "A file and label are required." },
			{ status: 400 },
		);
	}

	const ext = PERMIT_FILE_TYPES[file.type];
	if (!ext) {
		return NextResponse.json(
			{ error: "The file must be a PNG, JPEG, WebP or PDF." },
			{ status: 400 },
		);
	}

	if (file.size > LOCKER_FILE_MAX_BYTES) {
		return NextResponse.json(
			{ error: "The file is too large." },
			{
				status: 413,
			},
		);
	}

	const locker = await db.lockerDocument.create({
		data: {
			label: label.trim(),
			kind: typeof kind === "string" && kind.trim() ? kind.trim() : "OTHER",
			fileName: "",
			contentType: file.type,
			createdById: session.user.id,
		},
	});

	const bytes = Buffer.from(await file.arrayBuffer());
	const fileName = await saveLockerFile(locker.id, ext, bytes);
	if (!fileName) {
		await db.lockerDocument.delete({ where: { id: locker.id } });
		return NextResponse.json(
			{ error: "The file could not be saved." },
			{ status: 500 },
		);
	}

	try {
		await db.lockerDocument.update({
			where: { id: locker.id },
			data: { fileName },
		});
	} catch {
		await removeLockerFile(fileName);
		await db.lockerDocument.delete({ where: { id: locker.id } });
		return NextResponse.json(
			{ error: "The file could not be saved." },
			{ status: 500 },
		);
	}

	return NextResponse.json({
		id: locker.id,
		url: `/api/permits/locker/${locker.id}?v=${Date.now()}`,
	});
}
