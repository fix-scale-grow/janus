import { ensureWorkspaceMembership, WORKSPACE_ID } from "@crm/auth";
import { AUTH_COOKIE_PREFIX } from "@crm/auth/cookies";
import { db } from "@crm/db";
import { type NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = `${AUTH_COOKIE_PREFIX}.session_token`;
const SESSION_DAYS = 7;
const DEFAULT_EMAIL = "dev@localhost";

async function signCookieValue(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);
	const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
	return `${value}.${base64}`;
}

export async function GET(request: NextRequest) {
	if (process.env.NODE_ENV === "production") {
		return new NextResponse(null, { status: 404 });
	}

	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) {
		return new NextResponse("BETTER_AUTH_SECRET is not set.", { status: 500 });
	}

	const email =
		request.nextUrl.searchParams.get("email")?.trim() || DEFAULT_EMAIL;
	const name = email.split("@")[0] ?? "Developer";

	const user = await db.user.upsert({
		where: { email },
		create: {
			id: `dev-${Buffer.from(email).toString("hex").slice(0, 20)}`,
			email,
			name,
			emailVerified: true,
			updatedAt: new Date(),
		},
		update: {},
	});

	await ensureWorkspaceMembership(user.id);
	await db.member.update({
		where: {
			organizationId_userId: { organizationId: WORKSPACE_ID, userId: user.id },
		},
		data: { role: "owner" },
	});

	const token = `dev-session-${user.id}`;
	const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

	await db.session.upsert({
		where: { token },
		create: {
			id: token,
			token,
			userId: user.id,
			expiresAt,
			updatedAt: new Date(),
		},
		update: { expiresAt },
	});

	const response = NextResponse.redirect(new URL("/", request.url));
	response.cookies.set({
		name: COOKIE_NAME,
		value: await signCookieValue(token, secret),
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		expires: expiresAt,
	});
	return response;
}
