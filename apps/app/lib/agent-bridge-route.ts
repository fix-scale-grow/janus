import type { AccessPrincipal } from "@crm/db/access-policy";
import { z } from "zod";
import {
	agentRecordsVisible,
	JANUS_CHAT_UNAVAILABLE,
	janusChatAllowed,
} from "./access-route";
import {
	AGENT_URL,
	BRIDGE,
	bridgeConfigured,
	mintBridgeToken,
} from "./agent-bridge";
import {
	AGENT_SESSION_ROUTE,
	conversationFiling,
	type FiledSession,
	fileBridgeConversation,
	matchEveRoute,
	resetOwnedBy,
	sessionRecordAnchors,
} from "./agent-conversation-route";

export type BridgeUser = { id: string; email: string; name: string };

export type BridgeDeps = {
	user: () => Promise<BridgeUser | null>;
	principal: (userId: string) => Promise<AccessPrincipal | null>;
	fetch: (url: string, init: RequestInit) => Promise<Response>;
};

const STRIPPED_REQUEST_HEADERS = [
	"host",
	"cookie",
	"x-forwarded-host",
	"x-forwarded-proto",
	"x-forwarded-for",
	"forwarded",
	"transfer-encoding",
	"connection",
	"keep-alive",
	"content-length",
	"expect",
	"x-crm-contact",
	"x-crm-deal",
	"x-crm-drawing",
	"x-crm-builder-conversation",
];

const STRIPPED_RESPONSE_HEADERS = [
	"transfer-encoding",
	"connection",
	"content-encoding",
	"content-length",
];

const resetBody = z.object({ continuationToken: z.string() });

const notFound = (error: string) => Response.json({ error }, { status: 404 });

export async function bridgeEveRequest(
	request: Request,
	deps: BridgeDeps,
): Promise<Response> {
	if (!bridgeConfigured()) {
		return Response.json(
			{ error: "The research agent is not configured for this install." },
			{ status: 503 },
		);
	}

	const user = await deps.user();
	if (!user) {
		return Response.json({ error: "Not signed in." }, { status: 401 });
	}

	const principal = await deps.principal(user.id);
	if (!janusChatAllowed(principal)) {
		return Response.json({ error: JANUS_CHAT_UNAVAILABLE }, { status: 403 });
	}

	const url = new URL(request.url);
	const route = matchEveRoute(request.method, url.pathname);
	if (!route) return notFound("Not found.");

	const contactId = header(request, "x-crm-contact");
	const dealId = header(request, "x-crm-deal");
	const drawingId = header(request, "x-crm-drawing");
	const builderConversationId = header(request, "x-crm-builder-conversation");
	const requestedSession = route.kind === "session" ? route.sessionId : null;

	let filedAnchors: FiledSession | null = null;
	if (requestedSession) {
		filedAnchors = await sessionRecordAnchors(requestedSession, user.id);
		if (!filedAnchors) return notFound("Conversation not found.");
	}

	if (builderConversationId && route.kind !== "session") {
		return Response.json(
			{ error: "A builder conversation starts on the server." },
			{ status: 400 },
		);
	}

	if (
		builderConversationId &&
		(filedAnchors?.kind !== "BUILDER" ||
			filedAnchors.id !== builderConversationId)
	) {
		return notFound("Conversation not found.");
	}

	const headerRecord = {
		contactId: cuid(contactId),
		dealId: cuid(dealId),
		drawingId: cuid(drawingId),
	};
	const malformedHeader =
		(contactId !== null && !headerRecord.contactId) ||
		(dealId !== null && !headerRecord.dealId) ||
		(drawingId !== null && !headerRecord.drawingId);
	if (malformedHeader) {
		return notFound("Record not found.");
	}

	if (
		filedAnchors &&
		((contactId !== null &&
			headerRecord.contactId !== filedAnchors.contactId) ||
			(dealId !== null && headerRecord.dealId !== filedAnchors.dealId) ||
			(drawingId !== null && headerRecord.drawingId !== filedAnchors.drawingId))
	) {
		return notFound("Record not found.");
	}

	const record = filedAnchors ?? headerRecord;
	if (!(await agentRecordsVisible(principal, record))) {
		return notFound("Record not found.");
	}
	if (route.kind === "create" && !conversationFiling(record)) {
		return Response.json(
			{ error: "Choose exactly one contact, deal or drawing." },
			{ status: 400 },
		);
	}

	let body: BodyInit | null = request.body;
	if (route.kind === "reset") {
		const contentLength = request.headers.get("content-length");
		if (
			contentLength !== null &&
			Number(contentLength) > BRIDGE.reset.maxBodyBytes
		) {
			return Response.json({ error: "Request too large." }, { status: 413 });
		}
		const text = await readLimited(request, BRIDGE.reset.maxBodyBytes);
		if (text === null) {
			return Response.json({ error: "Request too large." }, { status: 413 });
		}
		const parsed = resetBody.safeParse(safeJson(text));
		if (
			!parsed.success ||
			!(await resetOwnedBy(parsed.data.continuationToken, user.id))
		) {
			return notFound("Conversation not found.");
		}
		body = text;
	}

	const headers = new Headers(request.headers);
	for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);
	const authorization = `Bearer ${await mintBridgeToken(user, record)}`;
	headers.set("authorization", authorization);

	const init: RequestInit & { duplex?: "half" } = {
		method: request.method,
		headers,
		redirect: "manual",
		signal: request.signal,
	};
	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = body;
		if (body instanceof ReadableStream) init.duplex = "half";
	}

	let upstream: Response;
	try {
		upstream = await deps.fetch(`${AGENT_URL}${route.path}${url.search}`, init);
	} catch (error) {
		console.error("[eve bridge] upstream fetch failed", {
			reason: error instanceof Error ? error.message : String(error),
		});
		return Response.json(
			{ error: "Janus is unavailable right now. Try again." },
			{ status: 502 },
		);
	}

	const createdSession =
		route.kind === "create"
			? upstream.headers.get(AGENT_SESSION_ROUTE.sessionHeader)
			: null;
	if (upstream.ok && createdSession) {
		try {
			await fileBridgeConversation({
				sessionId: createdSession,
				userId: user.id,
				record,
			});
		} catch (error) {
			console.error("[eve bridge] could not file a new conversation", {
				sessionId: createdSession,
				userId: user.id,
				reason: error instanceof Error ? error.message : String(error),
			});
			await upstream.body?.cancel().catch(() => {});
			await cancelOrphan(deps, createdSession, authorization);
			return Response.json(
				{ error: "Couldn't start the chat. Try again." },
				{ status: 500 },
			);
		}
	}

	const responseHeaders = new Headers(upstream.headers);
	for (const name of STRIPPED_RESPONSE_HEADERS) responseHeaders.delete(name);

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders,
	});
}

async function cancelOrphan(
	deps: BridgeDeps,
	sessionId: string,
	authorization: string,
): Promise<void> {
	const route = matchEveRoute(
		"POST",
		`/${AGENT_SESSION_ROUTE.prefix.join("/")}/${encodeURIComponent(sessionId)}/cancel`,
	);
	if (!route) return;
	try {
		const response = await deps.fetch(`${AGENT_URL}${route.path}`, {
			method: "POST",
			headers: { authorization },
			redirect: "manual",
		});
		await response.body?.cancel().catch(() => {});
	} catch (error) {
		console.error("[eve bridge] could not cancel an unfiled session", {
			sessionId,
			reason: error instanceof Error ? error.message : String(error),
		});
	}
}

async function readLimited(
	request: Request,
	limit: number,
): Promise<string | null> {
	if (!request.body) return "";
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel().catch(() => {});
			return null;
		}
		chunks.push(value);
	}
	const buffer = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(buffer);
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function cuid(value: string | null): string | undefined {
	return value && /^[a-z0-9]{20,32}$/.test(value) ? value : undefined;
}

function header(request: Request, name: string): string | null {
	const value = request.headers.get(name);
	return value === "" ? null : value;
}
