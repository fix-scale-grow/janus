import { db } from "@crm/db";
import { NextResponse } from "next/server";
import {
	COST_ID_PATTERN,
	RECEIPT_TYPES,
	removeReceipt,
	saveReceipt,
} from "@/lib/cost-receipts";
import { getSession } from "@/lib/session";

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get("file");
	const costId = formData.get("costId");

	if (!(file instanceof Blob) || typeof costId !== "string" || !costId) {
		return NextResponse.json(
			{ error: "A file and costId are required." },
			{ status: 400 },
		);
	}

	if (!COST_ID_PATTERN.test(costId)) {
		return NextResponse.json({ error: "Invalid costId." }, { status: 400 });
	}

	const ext = RECEIPT_TYPES[file.type];
	if (!ext) {
		return NextResponse.json(
			{ error: "The receipt must be a PNG, JPEG, WebP or PDF." },
			{ status: 400 },
		);
	}

	if (file.size > RECEIPT_MAX_BYTES) {
		return NextResponse.json(
			{ error: "The receipt is too large." },
			{ status: 413 },
		);
	}

	const cost = await db.jobCost.findUnique({
		where: { id: costId },
		select: { receiptPath: true },
	});
	if (!cost) {
		return NextResponse.json({ error: "No cost found." }, { status: 404 });
	}

	if (cost.receiptPath && cost.receiptPath !== `${costId}.${ext}`) {
		await removeReceipt(cost.receiptPath);
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	const fileName = await saveReceipt(costId, ext, bytes);
	if (!fileName) {
		return NextResponse.json(
			{ error: "The receipt could not be saved." },
			{ status: 500 },
		);
	}

	await db.jobCost.update({
		where: { id: costId },
		data: { receiptPath: fileName },
	});

	return NextResponse.json({
		url: `/api/costs/receipt/${costId}?v=${Date.now()}`,
	});
}
