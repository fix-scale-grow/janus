import { afterAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import { NextRequest } from "next/server";
import { GET } from "./route";

const suffix =
	process.env.TEST_RUN_ID ?? `dev-login-${crypto.randomUUID().slice(0, 8)}`;
const emailLower = `route-case-${suffix}@example.test`;
const emailMixed = `Route-Case-${suffix.toUpperCase()}@Example.Test`;

function requestFor(email: string): NextRequest {
	return new NextRequest(
		`http://localhost:3117/api/dev-login?email=${encodeURIComponent(email)}`,
	);
}

afterAll(async () => {
	await db.session.deleteMany({
		where: { user: { email: emailLower.toLowerCase() } },
	});
	await db.member.deleteMany({
		where: { user: { email: emailLower.toLowerCase() } },
	});
	await db.user.deleteMany({ where: { email: emailLower.toLowerCase() } });
});

describe("GET /api/dev-login", () => {
	test("differing case for the same email resolves to one user, not a collision", async () => {
		const first = await GET(requestFor(emailLower));
		expect(first.status).toBe(307);

		const second = await GET(requestFor(emailMixed));
		expect(second.status).toBe(307);

		const rows = await db.user.findMany({
			where: { email: emailLower.toLowerCase() },
			select: { id: true, email: true },
		});
		expect(rows.length).toBe(1);
		expect(rows[0]?.email).toBe(emailLower.toLowerCase());
	});
});
