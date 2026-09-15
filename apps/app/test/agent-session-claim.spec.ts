import { describe, expect, it } from "bun:test";
import {
	AGENT_SESSION_CLAIM,
	addClaim,
	claimCookie,
	claimCookieValue,
	isSessionCreate,
	readClaims,
	requestedSessionId,
	sessionAllowed,
	signClaims,
} from "../lib/agent-session-claim";

const SECRET = "test-secret-at-least-long-enough-to-be-a-secret";
const NOW = 1_000_000;

describe("requestedSessionId", () => {
	it("reads the session id from stream, continue and cancel paths", () => {
		expect(requestedSessionId("/eve/v1/session/ses_1/stream")).toBe("ses_1");
		expect(requestedSessionId("/eve/v1/session/ses_1")).toBe("ses_1");
		expect(requestedSessionId("/eve/v1/session/ses_1/cancel")).toBe("ses_1");
	});

	it("names no session when a new chat starts or a session resets", () => {
		expect(requestedSessionId("/eve/v1/session")).toBeNull();
		expect(requestedSessionId("/eve/v1/session/reset")).toBeNull();
		expect(isSessionCreate("POST", "/eve/v1/session")).toBe(true);
		expect(isSessionCreate("POST", "/eve/v1/session/ses_1")).toBe(false);
	});
});

describe("sessionAllowed", () => {
	const base = { userId: "user_1", claims: [], now: NOW };

	it("lets a new chat start, because it names no session", () => {
		expect(
			sessionAllowed({ ...base, sessionId: null, conversation: null }),
		).toBe(true);
	});

	it("lets the owner reach a filed conversation, including a builder conversation", () => {
		expect(
			sessionAllowed({
				...base,
				sessionId: "ses_builder",
				conversation: { userId: "user_1" },
			}),
		).toBe(true);
	});

	it("refuses another person's filed conversation", () => {
		expect(
			sessionAllowed({
				...base,
				sessionId: "ses_1",
				conversation: { userId: "user_2" },
			}),
		).toBe(false);
	});

	it("refuses a session nobody filed and this caller did not start", () => {
		expect(
			sessionAllowed({ ...base, sessionId: "ses_1", conversation: null }),
		).toBe(false);
	});

	it("lets the caller stream a session they just started, before it is filed", () => {
		const claims = addClaim(
			[],
			{ sessionId: "ses_new", userId: "user_1" },
			NOW,
		);
		expect(
			sessionAllowed({
				...base,
				claims,
				sessionId: "ses_new",
				conversation: null,
			}),
		).toBe(true);
		expect(
			sessionAllowed({
				...base,
				userId: "user_2",
				claims,
				sessionId: "ses_new",
				conversation: null,
			}),
		).toBe(false);
		expect(
			sessionAllowed({
				...base,
				claims,
				now: NOW + AGENT_SESSION_CLAIM.ttlMs + 1,
				sessionId: "ses_new",
				conversation: null,
			}),
		).toBe(false);
	});
});

describe("session claim cookie", () => {
	it("round-trips a signed claim", async () => {
		const claims = addClaim([], { sessionId: "ses_1", userId: "user_1" }, NOW);
		const cookie = claimCookie(await signClaims(claims, SECRET), true);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Path=/eve/v1");
		const value = claimCookieValue(`other=1; ${cookie.split(";")[0]}`);
		expect(await readClaims(value, SECRET)).toEqual(claims);
	});

	it("ignores a claim signed with another secret or edited by the browser", async () => {
		const claims = addClaim([], { sessionId: "ses_1", userId: "user_1" }, NOW);
		const signed = await signClaims(claims, SECRET);
		expect(await readClaims(signed, `${SECRET}-other`)).toEqual([]);
		const forged = await signClaims(
			addClaim([], { sessionId: "ses_1", userId: "user_2" }, NOW),
			`${SECRET}-other`,
		);
		const [, signature] = signed.split(".");
		const [body] = forged.split(".");
		expect(await readClaims(`${body}.${signature}`, SECRET)).toEqual([]);
	});

	it("keeps only the newest live claims", () => {
		let claims = addClaim([], { sessionId: "old", userId: "u" }, NOW);
		for (let index = 0; index < AGENT_SESSION_CLAIM.maxSessions; index++) {
			claims = addClaim(claims, { sessionId: `s${index}`, userId: "u" }, NOW);
		}
		expect(claims).toHaveLength(AGENT_SESSION_CLAIM.maxSessions);
		expect(claims.map((claim) => claim.sessionId)).not.toContain("old");
	});
});
