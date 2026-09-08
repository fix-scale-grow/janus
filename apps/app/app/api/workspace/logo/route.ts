import { canRenameWorkspace, WORKSPACE_ID, workspaceRoleOf } from "@crm/auth";
import { db } from "@crm/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
	isSvgSafe,
	LOGO_TYPES,
	matchesDeclaredType,
	removeLogo,
	saveLogo,
} from "@/lib/workspace-logo";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

async function requireCanRename(): Promise<
	{ ok: true } | { ok: false; response: Response }
> {
	const session = await getSession();
	if (!session) {
		return {
			ok: false,
			response: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
		};
	}

	const role = await workspaceRoleOf(session.user.id);
	if (!canRenameWorkspace(role)) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Only an owner or an admin can change the workspace." },
				{ status: 403 },
			),
		};
	}

	return { ok: true };
}

export async function POST(request: Request): Promise<Response> {
	const gate = await requireCanRename();
	if (!gate.ok) return gate.response;

	const formData = await request.formData();
	const file = formData.get("file");

	if (!(file instanceof Blob)) {
		return NextResponse.json({ error: "A file is required." }, { status: 400 });
	}

	const ext = LOGO_TYPES[file.type];
	if (!ext) {
		return NextResponse.json(
			{ error: "The logo must be a PNG, SVG, JPEG or WebP." },
			{ status: 400 },
		);
	}

	if (file.size > LOGO_MAX_BYTES) {
		return NextResponse.json(
			{ error: "The logo is too large." },
			{ status: 413 },
		);
	}

	const bytes = Buffer.from(await file.arrayBuffer());

	if (!matchesDeclaredType(file.type, bytes)) {
		return NextResponse.json(
			{ error: "The file content does not match its declared type." },
			{ status: 400 },
		);
	}

	if (file.type === "image/svg+xml" && !isSvgSafe(bytes)) {
		return NextResponse.json(
			{
				error:
					"That SVG contains scripting or an external reference and cannot be used as a logo.",
			},
			{ status: 400 },
		);
	}

	const url = await saveLogo(ext, bytes);
	if (!url) {
		return NextResponse.json(
			{ error: "The logo could not be saved." },
			{ status: 500 },
		);
	}

	await db.organization.update({
		where: { id: WORKSPACE_ID },
		data: { logo: url },
	});

	return NextResponse.json({ url });
}

export async function DELETE(): Promise<Response> {
	const gate = await requireCanRename();
	if (!gate.ok) return gate.response;

	await removeLogo();
	await db.organization.update({
		where: { id: WORKSPACE_ID },
		data: { logo: null },
	});

	return NextResponse.json({ ok: true });
}
