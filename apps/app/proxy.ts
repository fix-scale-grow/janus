import { AUTH_COOKIE_PREFIX } from "@crm/auth/cookies";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import {
	areaRedirect,
	fieldRedirect,
	settingsRedirect,
} from "@/lib/access-rules";
import { isMarketing } from "@/lib/env";
import { JANUS_LIVE_NAV } from "@/lib/janus-nav";
import {
	ONBOARDING_PATH,
	readAccessGate,
	readWorkspaceGate,
} from "@/lib/onboarding";
import { workspaceUrl } from "@/lib/workspace-url";

const LANDING_PATH = "/";

const SIGN_IN_PATH = "/sign-in";

const UNGATED = ["/grant-access", "/eve"];

const ANONYMOUS = ["/t", "/f", "/sign", "/proposal"];

const SECTIONS = ["/contacts", "/deals", "/settings"];

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (pathname === SIGN_IN_PATH) return NextResponse.next();

	if (isAnonymous(pathname)) return NextResponse.next();

	if (
		getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX }) === null
	) {
		return isPublic(pathname)
			? NextResponse.next()
			: NextResponse.redirect(new URL(SIGN_IN_PATH, request.nextUrl));
	}

	if (isUngated(pathname)) return NextResponse.next();

	const [workspace, access] = await Promise.all([
		readWorkspaceGate(request),
		readAccessGate(request),
	]);

	if (workspace.gate === "required") return sendTo(ONBOARDING_PATH, request);

	if (workspace.gate !== "settled" || !workspace.slug) {
		return NextResponse.next();
	}

	const target = appPath(pathname, workspace.slug);
	const fieldTarget = fieldRedirect(access.surface, target, workspace.slug);
	if (fieldTarget) return sendTo(fieldTarget, request);

	const settingsTarget = settingsRedirect(
		access.isAdmin,
		target,
		workspace.slug,
	);

	const areaTarget = areaRedirect(
		access.areaAccess,
		target,
		workspace.slug,
		JANUS_LIVE_NAV,
	);

	return sendTo(settingsTarget ?? areaTarget ?? target, request);
}

function appPath(pathname: string, slug: string): string {
	if (pathname === LANDING_PATH || isSetup(pathname)) {
		return workspaceUrl(slug);
	}

	if (SECTIONS.some((section) => isUnder(pathname, section))) {
		return workspaceUrl(slug, pathname);
	}

	const [first, ...rest] = pathname.slice(1).split("/");

	if (first === slug) return pathname;

	return workspaceUrl(slug, rest.length ? `/${rest.join("/")}` : "/");
}

function isUnder(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublic(pathname: string): boolean {
	return pathname === LANDING_PATH && isMarketing();
}

function isUngated(pathname: string): boolean {
	return UNGATED.some((prefix) => isUnder(pathname, prefix));
}

function isAnonymous(pathname: string): boolean {
	return ANONYMOUS.some((prefix) => isUnder(pathname, prefix));
}

function isSetup(pathname: string): boolean {
	return isUnder(pathname, ONBOARDING_PATH);
}

function sendTo(path: string, request: NextRequest): NextResponse {
	if (request.nextUrl.pathname === path) return NextResponse.next();

	const url = new URL(path, request.nextUrl);
	url.search = request.nextUrl.search;

	return NextResponse.redirect(url);
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|webmanifest|js|mjs|excalidrawlib)$).*)",
	],
};
