import { afterEach, describe, expect, it } from "bun:test";
import { AUTH_COOKIE_PREFIX } from "@crm/auth/cookies";
import { NextRequest } from "next/server";
import { readWorkspaceGate } from "../lib/onboarding";
import { proxy } from "../proxy";

const SESSION_COOKIE = `${AUTH_COOKIE_PREFIX}.session_token=abc.def`;

const SLUG = "comp-ai";

const realFetch = globalThis.fetch;

const realMarketing = process.env.IS_MARKETING;

afterEach(() => {
	globalThis.fetch = realFetch;
	marketing(realMarketing);
});

function marketing(value: string | undefined) {
	if (value === undefined) delete process.env.IS_MARKETING;
	else process.env.IS_MARKETING = value;
}

function stub(handler: (url: string) => Promise<Response>) {
	globalThis.fetch = ((input: string | URL | Request) =>
		handler(String(input))) as unknown as typeof fetch;
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function answerWith(body: unknown, status = 200) {
	stub(async () => json(body, status));
}

const gate = (data: {
	onboarded: boolean;
	canRename: boolean;
	slug?: string;
	surface?: "FULL" | "FIELD";
	isAdmin?: boolean;
}) => ({
	result: {
		data: {
			slug: SLUG,
			surface: "FULL" as const,
			isAdmin: true,
			...data,
		},
	},
});

function setup({
	onboarded = true,
	canRename = true,
	slug = SLUG,
	isAdmin = true,
}: {
	onboarded?: boolean;
	canRename?: boolean;
	slug?: string;
	isAdmin?: boolean;
} = {}) {
	const calls = { gate: 0 };

	stub(async (url) => {
		expect(url).toContain("workspace.gate");
		calls.gate += 1;
		return json(
			gate({
				onboarded,
				canRename,
				slug,
				isAdmin,
			}),
		);
	});

	return calls;
}

function request(pathname: string, cookies: string[] = []) {
	return new NextRequest(new URL(pathname, "http://localhost:3000"), {
		headers: cookies.length ? { cookie: cookies.join("; ") } : {},
	});
}

function redirectedTo(response: Response): string | null {
	const location = response.headers.get("location");

	return location ? new URL(location).pathname : null;
}

async function gateOf(pathname: string) {
	return (await readWorkspaceGate(request(pathname, [SESSION_COOKIE]))).gate;
}

describe("readWorkspaceGate", () => {
	it("reads the answer out of a plain tRPC envelope", async () => {
		answerWith(gate({ onboarded: false, canRename: true }));

		expect(await gateOf("/")).toBe("required");
	});

	it("settles for someone who could not answer the form anyway", async () => {
		answerWith(gate({ onboarded: false, canRename: false }));

		expect(await gateOf("/")).toBe("settled");
	});

	it("carries the slug the app is served under", async () => {
		answerWith(gate({ onboarded: true, canRename: true }));

		expect(await readWorkspaceGate(request("/", [SESSION_COOKIE]))).toEqual({
			gate: "settled",
			slug: SLUG,
		});
	});

	it("is unknown rather than required when the API cannot be read", async () => {
		answerWith({ error: { message: "UNAUTHORIZED" } }, 401);
		expect(await gateOf("/")).toBe("unknown");

		stub(async () => {
			throw new Error("connect ECONNREFUSED");
		});
		expect(await gateOf("/")).toBe("unknown");

		answerWith({ result: { data: { nothing: "useful" } } });
		expect(await gateOf("/")).toBe("unknown");
	});
});

describe("proxy", () => {
	it("shows a stranger the landing page and nothing behind it", async () => {
		marketing("true");

		expect(redirectedTo(await proxy(request("/")))).toBeNull();
		expect(redirectedTo(await proxy(request("/sign-in")))).toBeNull();
		expect(redirectedTo(await proxy(request(`/${SLUG}`)))).toBe("/sign-in");
		expect(redirectedTo(await proxy(request(`/${SLUG}/contacts`)))).toBe(
			"/sign-in",
		);
	});

	it("sends a stranger to sign in when the install has no landing page", async () => {
		marketing(undefined);

		expect(redirectedTo(await proxy(request("/")))).toBe("/sign-in");
		expect(redirectedTo(await proxy(request("/sign-in")))).toBeNull();
	});

	it("never aims a redirect at the sign-in page itself", async () => {
		marketing(undefined);
		setup({ onboarded: false });

		expect(redirectedTo(await proxy(request("/sign-in")))).toBeNull();
		expect(
			redirectedTo(await proxy(request("/sign-in", [SESSION_COOKIE]))),
		).toBeNull();
		expect(
			redirectedTo(await proxy(request("/sign-in?method=google"))),
		).toBeNull();
	});

	it("reads the flag on every request, and only the literal true turns it on", async () => {
		marketing("false");
		expect(redirectedTo(await proxy(request("/")))).toBe("/sign-in");

		marketing("1");
		expect(redirectedTo(await proxy(request("/")))).toBe("/sign-in");

		marketing("true");
		expect(redirectedTo(await proxy(request("/")))).toBeNull();
	});

	it("ignores a neighbour's cookie from the parent domain", async () => {
		expect(AUTH_COOKIE_PREFIX).not.toBe("better-auth");
		setup();

		expect(
			redirectedTo(
				await proxy(
					request(`/${SLUG}/contacts`, [
						"better-auth.session_token=someone.else",
					]),
				),
			),
		).toBe("/sign-in");
	});

	it("gates a signed-in rep who has not answered the form", async () => {
		setup({ onboarded: false });

		expect(
			redirectedTo(await proxy(request(`/${SLUG}/contacts`, [SESSION_COOKIE]))),
		).toBe("/onboarding");
	});

	it("lets the form itself render", async () => {
		setup({ onboarded: false });

		expect(
			redirectedTo(await proxy(request("/onboarding", [SESSION_COOKIE]))),
		).toBeNull();
	});

	it("asks again on every request, and remembers nothing, with one API call per visit", async () => {
		const calls = setup();

		const first = await proxy(request(`/${SLUG}/contacts`, [SESSION_COOKIE]));

		expect([...first.cookies.getAll()]).toHaveLength(0);
		expect(calls.gate).toBe(1);

		await proxy(request(`/${SLUG}/contacts`, [SESSION_COOKIE]));

		expect(calls.gate).toBe(2);
	});

	it("notices when the answer changes underneath it", async () => {
		setup();
		expect(
			redirectedTo(await proxy(request(`/${SLUG}/contacts`, [SESSION_COOKIE]))),
		).toBeNull();

		setup({ onboarded: false });
		expect(
			redirectedTo(await proxy(request(`/${SLUG}/contacts`, [SESSION_COOKIE]))),
		).toBe("/onboarding");
	});

	it("takes a settled rep off both setup pages and into the workspace", async () => {
		setup();

		expect(
			redirectedTo(await proxy(request("/onboarding", [SESSION_COOKIE]))),
		).toBe(`/${SLUG}`);

		expect(
			redirectedTo(
				await proxy(request("/onboarding/research", [SESSION_COOKIE])),
			),
		).toBe(`/${SLUG}`);
	});

	it("never fights /grant-access, which would ping-pong forever", async () => {
		setup({ onboarded: false });

		expect(
			redirectedTo(await proxy(request("/grant-access", [SESSION_COOKIE]))),
		).toBeNull();
	});

	it("leaves the agent bridge alone", async () => {
		setup({ onboarded: false });

		expect(
			redirectedTo(await proxy(request("/eve/v1/info", [SESSION_COOKIE]))),
		).toBeNull();
	});

	it("lets a signed-out client sign a contract, with no cookie at all", async () => {
		expect(redirectedTo(await proxy(request("/sign/abc123")))).toBeNull();
	});

	it("never gates the signing link behind onboarding either", async () => {
		setup({ onboarded: false });

		expect(
			redirectedTo(await proxy(request("/sign/abc123", [SESSION_COOKIE]))),
		).toBeNull();
	});

	it("fails open when the API is unreachable", async () => {
		stub(async () => {
			throw new Error("connect ECONNREFUSED");
		});

		const response = await proxy(
			request(`/${SLUG}/contacts`, [SESSION_COOKIE]),
		);

		expect(redirectedTo(response)).toBeNull();
	});
});

describe("the slug the app is served under", () => {
	it("sends a signed-in rep off the landing page and into the workspace", async () => {
		setup();

		expect(redirectedTo(await proxy(request("/", [SESSION_COOKIE])))).toBe(
			`/${SLUG}`,
		);
	});

	it("puts the slug on a link that predates it, keeping the query", async () => {
		setup();

		const response = await proxy(
			request("/contacts?record=contact:abc", [SESSION_COOKIE]),
		);

		expect(response.headers.get("location")).toBe(
			`http://localhost:3000/${SLUG}/contacts?record=contact:abc`,
		);
	});

	it("moves a stale slug onto the current one, keeping the rest", async () => {
		setup();

		expect(
			redirectedTo(
				await proxy(request("/old-name/settings/members", [SESSION_COOKIE])),
			),
		).toBe(`/${SLUG}/settings/members`);
	});

	it("leaves a request that already carries the slug alone", async () => {
		setup();

		expect(
			redirectedTo(
				await proxy(request(`/${SLUG}/settings/sso`, [SESSION_COOKIE])),
			),
		).toBeNull();
	});

	it("rewrites nothing when the API could not say what the slug is", async () => {
		setup({ slug: "" });

		expect(
			redirectedTo(await proxy(request("/contacts", [SESSION_COOKIE]))),
		).toBeNull();
	});
});

describe("no research key step", () => {
	it("takes an onboarded admin with no research key straight into the workspace", async () => {
		setup({ isAdmin: true });

		expect(redirectedTo(await proxy(request("/", [SESSION_COOKIE])))).toBe(
			`/${SLUG}`,
		);
		expect(
			redirectedTo(await proxy(request(`/${SLUG}/contacts`, [SESSION_COOKIE]))),
		).toBeNull();
	});

	it("moves an old research step link into the workspace", async () => {
		setup();

		expect(
			redirectedTo(
				await proxy(request("/onboarding/research", [SESSION_COOKIE])),
			),
		).toBe(`/${SLUG}`);
	});

	it("does not ask the API for a research key", async () => {
		stub(async (url) => {
			expect(url).toContain("workspace.gate");
			return json({
				result: {
					data: {
						onboarded: true,
						canRename: true,
						slug: SLUG,
						surface: "FULL",
						isAdmin: true,
					},
				},
			});
		});

		expect(
			redirectedTo(await proxy(request("/onboarding", [SESSION_COOKIE]))),
		).toBe(`/${SLUG}`);
	});
});
