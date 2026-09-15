import { z } from "zod";

const MINUTE_MS = 60_000;

export const AGENT_SESSION_CLAIM = {
	cookie: "janus_agent_sessions",
	path: "/eve/v1",
	ttlMs: 30 * MINUTE_MS,
	maxSessions: 20,
	createPath: "/eve/v1/session",
	sessionHeader: "x-eve-session-id",
	reservedSegments: ["reset"],
} as const;

const claimsSchema = z.array(
	z.object({
		sessionId: z.string().min(1),
		userId: z.string().min(1),
		expiresAt: z.number().int(),
	}),
);

export type SessionClaim = z.infer<typeof claimsSchema>[number];

export type SessionConversation = { userId: string } | null;

export function requestedSessionId(pathname: string): string | null {
	const match = pathname.match(/\/eve\/v1\/session\/([^/]+)/);
	const segment = match?.[1] ? decodeURIComponent(match[1]) : null;
	if (!segment) return null;
	return (AGENT_SESSION_CLAIM.reservedSegments as readonly string[]).includes(
		segment,
	)
		? null
		: segment;
}

export function sessionAllowed(input: {
	sessionId: string | null;
	userId: string;
	conversation: SessionConversation;
	claims: readonly SessionClaim[];
	now: number;
}): boolean {
	if (!input.sessionId) return true;
	if (input.conversation) return input.conversation.userId === input.userId;
	return input.claims.some(
		(claim) =>
			claim.sessionId === input.sessionId &&
			claim.userId === input.userId &&
			claim.expiresAt > input.now,
	);
}

export function isSessionCreate(method: string, pathname: string): boolean {
	return method === "POST" && pathname === AGENT_SESSION_CLAIM.createPath;
}

export function addClaim(
	claims: readonly SessionClaim[],
	claim: { sessionId: string; userId: string },
	now: number,
): SessionClaim[] {
	const live = claims.filter(
		(entry) => entry.expiresAt > now && entry.sessionId !== claim.sessionId,
	);
	return [
		...live,
		{ ...claim, expiresAt: now + AGENT_SESSION_CLAIM.ttlMs },
	].slice(-AGENT_SESSION_CLAIM.maxSessions);
}

export async function signClaims(
	claims: readonly SessionClaim[],
	secret: string,
): Promise<string> {
	const body = base64url(JSON.stringify(claims));
	const signature = await crypto.subtle.sign(
		"HMAC",
		await key(secret),
		new TextEncoder().encode(body),
	);
	return `${body}.${base64url(new Uint8Array(signature))}`;
}

export async function readClaims(
	value: string | null,
	secret: string,
): Promise<SessionClaim[]> {
	if (!value) return [];
	const [body, signature] = value.split(".");
	if (!body || !signature) return [];
	const valid = await crypto.subtle.verify(
		"HMAC",
		await key(secret),
		fromBase64url(signature),
		new TextEncoder().encode(body),
	);
	if (!valid) return [];
	const parsed = claimsSchema.safeParse(
		JSON.parse(new TextDecoder().decode(fromBase64url(body))),
	);
	if (!parsed.success) {
		throw new Error(
			`The agent session claim is unreadable: ${parsed.error.message}`,
		);
	}
	return parsed.data;
}

export function claimCookieValue(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(";")) {
		const [name, ...rest] = part.trim().split("=");
		if (name === AGENT_SESSION_CLAIM.cookie) return rest.join("=");
	}
	return null;
}

export function claimCookie(value: string, secure: boolean): string {
	return [
		`${AGENT_SESSION_CLAIM.cookie}=${value}`,
		`Path=${AGENT_SESSION_CLAIM.path}`,
		`Max-Age=${Math.floor(AGENT_SESSION_CLAIM.ttlMs / 1000)}`,
		"HttpOnly",
		"SameSite=Strict",
		...(secure ? ["Secure"] : []),
	].join("; ");
}

async function key(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

function base64url(input: string | Uint8Array): string {
	const bytes =
		typeof input === "string" ? new TextEncoder().encode(input) : input;
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function fromBase64url(input: string): Uint8Array<ArrayBuffer> {
	const padded = input.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}
