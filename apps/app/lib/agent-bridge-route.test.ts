import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import { adminPrincipal } from "@crm/db/access-policy";
import { type BridgeDeps, bridgeEveRequest } from "./agent-bridge-route";

const suffix = process.env.TEST_RUN_ID ?? "agent-bridge-route";
const ownerId = `bridge-route-owner-${suffix}`;
const strangerId = `bridge-route-stranger-${suffix}`;
const email = `bridge.route.${suffix}@example.test`;
const email2 = `bridge.route.other.${suffix}@example.test`;
const ORIGIN = "http://app.test";

let contactId: string;
let otherContactId: string;
let previousSecret: string | undefined;

type Call = { url: string; init: RequestInit };

function deps(
	userId: string,
	respond: (call: Call) => Response | Promise<Response>,
): BridgeDeps & { calls: Call[] } {
	const calls: Call[] = [];
	return {
		calls,
		user: async () => ({
			id: userId,
			email: `${userId}@example.test`,
			name: userId,
		}),
		principal: async (id) => adminPrincipal(id),
		fetch: async (url, init) => {
			const call = { url, init };
			calls.push(call);
			return respond(call);
		},
	};
}

function created(sessionId: string, status = 202): Response {
	return new Response(JSON.stringify({ ok: true, sessionId }), {
		status,
		headers: {
			"content-type": "application/json",
			"x-eve-session-id": sessionId,
		},
	});
}

function post(path: string, headers: Record<string, string> = {}, body = "{}") {
	return new Request(`${ORIGIN}${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body,
	});
}

beforeAll(async () => {
	previousSecret = process.env.AGENT_BRIDGE_SECRET;
	process.env.AGENT_BRIDGE_SECRET ??= "bridge-route-test-secret-long-enough";
	await db.agentConversation.deleteMany({
		where: { userId: { in: [ownerId, strangerId] } },
	});
	await db.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
	await db.contact.deleteMany({ where: { email: { in: [email, email2] } } });
	await db.user.createMany({
		data: [ownerId, strangerId].map((id) => ({
			id,
			name: id,
			email: `${id}@example.test`,
		})),
	});
	const contact = await db.contact.create({
		data: { firstName: "Bridge", lastName: "Route", email },
		select: { id: true },
	});
	contactId = contact.id;
	const other = await db.contact.create({
		data: { firstName: "Bridge", lastName: "Other", email: email2 },
		select: { id: true },
	});
	otherContactId = other.id;
});

afterAll(async () => {
	await db.agentConversation.deleteMany({
		where: { userId: { in: [ownerId, strangerId] } },
	});
	await db.contact.deleteMany({ where: { email: { in: [email, email2] } } });
	await db.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
	if (previousSecret === undefined) delete process.env.AGENT_BRIDGE_SECRET;
	else process.env.AGENT_BRIDGE_SECRET = previousSecret;
});

describe("bridgeEveRequest", () => {
	test("files the row before the create response resolves", async () => {
		const sessionId = `wrun_${suffix}_create`;
		let rowsDuringFetch = -1;
		const d = deps(ownerId, async () => {
			rowsDuringFetch = await db.agentConversation.count({
				where: { sessionId },
			});
			return created(sessionId);
		});

		const response = await bridgeEveRequest(
			post("/eve/v1/session", { "x-crm-contact": contactId }),
			d,
		);

		expect(response.status).toBe(202);
		expect(rowsDuringFetch).toBe(0);
		expect(
			await db.agentConversation.findUnique({
				where: { sessionId },
				select: { userId: true, kind: true, contactId: true },
			}),
		).toEqual({ userId: ownerId, kind: "RECORD", contactId });
		expect(d.calls[0]?.url.endsWith("/eve/v1/session")).toBe(true);
	});

	test("refuses a builder header on create without calling eve", async () => {
		const d = deps(ownerId, () => created(`wrun_${suffix}_builder`));
		const response = await bridgeEveRequest(
			post("/eve/v1/session", {
				"x-crm-builder-conversation": "abcdefghijklmnopqrstu",
			}),
			d,
		);

		expect(response.status).toBe(400);
		expect(d.calls).toHaveLength(0);
	});

	test("refuses a malformed record header without calling eve", async () => {
		const d = deps(ownerId, () => created(`wrun_${suffix}_bad`));
		const response = await bridgeEveRequest(
			post("/eve/v1/session", { "x-crm-contact": "NOT-A-CUID" }),
			d,
		);

		expect(response.status).toBe(404);
		expect(d.calls).toHaveLength(0);
	});

	test("files nothing when eve refuses the create", async () => {
		const sessionId = `wrun_${suffix}_refused`;
		const d = deps(ownerId, () => created(sessionId, 500));
		const response = await bridgeEveRequest(post("/eve/v1/session"), d);

		expect(response.status).toBe(500);
		expect(await db.agentConversation.count({ where: { sessionId } })).toBe(0);
	});

	test("cancels the new session and hides the cause when filing fails", async () => {
		const sessionId = `wrun_${suffix}_taken`;
		await db.agentConversation.create({
			data: { kind: "WORKSPACE", sessionId, userId: strangerId },
		});
		const d = deps(ownerId, (call) =>
			call.url.endsWith("/cancel")
				? Response.json({ ok: true, status: "accepted" })
				: created(sessionId),
		);

		const response = await bridgeEveRequest(post("/eve/v1/session"), d);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Couldn't start the chat. Try again.",
		});
		expect(
			d.calls.map((call) => call.url.replace(/^.*\/eve\/v1/, "/eve/v1")),
		).toEqual(["/eve/v1/session", `/eve/v1/session/${sessionId}/cancel`]);
		const auth = (call: Call) =>
			new Headers(call.init.headers).get("authorization");
		expect(auth(d.calls[1] as Call)).toBe(auth(d.calls[0] as Call));
		expect(
			await db.agentConversation.findUnique({
				where: { sessionId },
				select: { userId: true },
			}),
		).toEqual({ userId: strangerId });
	});

	test("refuses a session path the caller does not own without calling eve", async () => {
		const sessionId = `wrun_${suffix}_foreign`;
		await db.agentConversation.create({
			data: { kind: "WORKSPACE", sessionId, userId: strangerId },
		});
		const d = deps(ownerId, () => new Response("{}"));

		for (const path of [
			`/eve/v1/session/${sessionId}/stream`,
			`/eve/v1/session//${sessionId}/stream`,
			`/eve/v1/%73ession/${sessionId}/stream`,
		]) {
			const response = await bridgeEveRequest(
				new Request(`${ORIGIN}${path}`),
				d,
			);
			expect(response.status).toBe(404);
		}
		expect(d.calls).toHaveLength(0);
	});

	test("streams an owned session through its canonical path", async () => {
		const sessionId = `wrun_${suffix}_owned`;
		await db.agentConversation.create({
			data: { kind: "WORKSPACE", sessionId, userId: ownerId },
		});
		const d = deps(ownerId, () => new Response("{}\n"));
		const response = await bridgeEveRequest(
			new Request(
				`${ORIGIN}/eve/v1/%73ession/${sessionId}/stream?startIndex=0`,
			),
			d,
		);

		expect(response.status).toBe(200);
		expect(
			d.calls[0]?.url.endsWith(
				`/eve/v1/session/${sessionId}/stream?startIndex=0`,
			),
		).toBe(true);
	});

	test("forwards a reset only for a continuation token the caller owns", async () => {
		const sessionId = `wrun_${suffix}_reset`;
		await db.agentConversation.create({
			data: {
				kind: "WORKSPACE",
				sessionId,
				userId: ownerId,
				continuationToken: `eve:${suffix}-reset`,
			},
		});
		const body = JSON.stringify({ continuationToken: `eve:${suffix}-reset` });

		const stranger = deps(strangerId, () => Response.json({ ok: true }));
		expect(
			(
				await bridgeEveRequest(
					post("/eve/v1/session/reset", {}, body),
					stranger,
				)
			).status,
		).toBe(404);
		expect(stranger.calls).toHaveLength(0);

		const owner = deps(ownerId, () => Response.json({ ok: true }));
		expect(
			(await bridgeEveRequest(post("/eve/v1/session/reset", {}, body), owner))
				.status,
		).toBe(200);
		expect(owner.calls[0]?.init.body).toBe(body);
	});

	test("hides the upstream failure detail behind a generic message", async () => {
		const d = deps(ownerId, () => {
			throw new Error("connect ECONNREFUSED 127.0.0.1:2000");
		});
		const response = await bridgeEveRequest(post("/eve/v1/session"), d);

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({
			error: "Janus is unavailable right now. Try again.",
		});
	});

	test("rejects an oversized reset body declared by content-length without calling eve", async () => {
		const d = deps(ownerId, () => Response.json({ ok: true }));
		const body = JSON.stringify({ continuationToken: "x".repeat(20_000) });
		const response = await bridgeEveRequest(
			post("/eve/v1/session/reset", {}, body),
			d,
		);

		expect(response.status).toBe(413);
		expect(await response.json()).toEqual({ error: "Request too large." });
		expect(d.calls).toHaveLength(0);
	});

	test("rejects an oversized chunked reset body with no content-length", async () => {
		const chunk = new TextEncoder().encode("a".repeat(4096));
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (let i = 0; i < 6; i++) controller.enqueue(chunk);
				controller.close();
			},
		});
		const request = new Request(`${ORIGIN}/eve/v1/session/reset`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: stream,
			duplex: "half",
		} as RequestInit & { duplex: "half" });
		expect(request.headers.get("content-length")).toBeNull();

		const d = deps(ownerId, () => Response.json({ ok: true }));
		const response = await bridgeEveRequest(request, d);

		expect(response.status).toBe(413);
		expect(await response.json()).toEqual({ error: "Request too large." });
		expect(d.calls).toHaveLength(0);
	});

	test("refuses a session request whose record header names a different record than the filed row", async () => {
		const sessionId = `wrun_${suffix}_pinned`;
		await db.agentConversation.create({
			data: { kind: "RECORD", sessionId, userId: ownerId, contactId },
		});
		const d = deps(ownerId, () => new Response("{}"));

		const response = await bridgeEveRequest(
			post(
				`/eve/v1/session/${sessionId}`,
				{ "x-crm-contact": otherContactId },
				"{}",
			),
			d,
		);

		expect(response.status).toBe(404);
		expect(d.calls).toHaveLength(0);
	});

	test("forwards a session request whose record header matches the filed row's anchor", async () => {
		const sessionId = `wrun_${suffix}_pinned_match`;
		await db.agentConversation.create({
			data: { kind: "RECORD", sessionId, userId: ownerId, contactId },
		});
		const d = deps(ownerId, () => new Response("{}"));

		const response = await bridgeEveRequest(
			post(
				`/eve/v1/session/${sessionId}`,
				{ "x-crm-contact": contactId },
				"{}",
			),
			d,
		);

		expect(response.status).toBe(200);
		expect(d.calls).toHaveLength(1);
	});

	test("refuses paths outside the allowlist without calling eve", async () => {
		const d = deps(ownerId, () => new Response("{}"));
		for (const request of [
			new Request(`${ORIGIN}/eve/v1/info`),
			post("/eve/v1/session/"),
			post("/eve/v1/dev/runtime-artifacts/rebuild"),
		]) {
			expect((await bridgeEveRequest(request, d)).status).toBe(404);
		}
		expect(d.calls).toHaveLength(0);
	});
});
