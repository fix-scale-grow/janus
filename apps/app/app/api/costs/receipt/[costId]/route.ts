import { db } from "@crm/db";
import { NextResponse } from "next/server";
import {
	COST_ID_PATTERN,
	contentTypeFor,
	RECEIPT_TYPES,
	readReceipt,
	removeReceipt,
} from "@/lib/cost-receipts";
import { getSession } from "@/lib/session";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ costId: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const { costId } = await params;
	if (!COST_ID_PATTERN.test(costId)) {
		return NextResponse.json({ error: "Invalid costId." }, { status: 400 });
	}

	const cost = await db.jobCost.findUnique({
		where: { id: costId },
		select: { receiptPath: true },
	});
	if (!cost?.receiptPath) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const bytes = await readReceipt(cost.receiptPath);
	if (!bytes) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	return new NextResponse(new Uint8Array(bytes), {
		headers: {
			"content-type": contentTypeFor(cost.receiptPath),
			"cache-control": "private, max-age=31536000, immutable",
		},
	});
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ costId: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const { costId } = await params;
	if (!COST_ID_PATTERN.test(costId)) {
		return NextResponse.json({ error: "Invalid costId." }, { status: 400 });
	}

	const cost = await db.jobCost.findUnique({
		where: { id: costId },
		select: { receiptPath: true },
	});

	if (cost?.receiptPath) {
		await removeReceipt(cost.receiptPath);
		await db.jobCost.update({
			where: { id: costId },
			data: { receiptPath: null },
		});
		return NextResponse.json({ ok: true });
	}

	for (const ext of Object.values(RECEIPT_TYPES)) {
		const fileName = `${costId}.${ext}`;
		const bytes = await readReceipt(fileName);
		if (!bytes) continue;
		await removeReceipt(fileName);
		return NextResponse.json({ ok: true });
	}

	return NextResponse.json({ error: "Not found." }, { status: 404 });
}
