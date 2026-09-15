import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { TRPCError } from "@trpc/server";
import { access } from "../src/access/access.meta";
import { AccessMiddleware } from "../src/access/access.middleware";
import { AccessService } from "../src/access/access.service";

const suffix = process.env.TEST_RUN_ID ?? "access-middleware";
const service = new AccessService(db);
const middleware = new AccessMiddleware(service);
const crewLeadId = `crew-${suffix}`;

const noopNext = async () => ({ ok: true as const, data: undefined });

beforeAll(async () => {
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: "Test",
			slug: `ws-${suffix}`,
			createdAt: new Date(),
		},
	});
	await db.user.create({
		data: {
			id: crewLeadId,
			name: "Crew Lead",
			email: `${crewLeadId}@example.test`,
		},
	});
	const { ensureAccessGroups } = await import("@crm/db/access-resolve");
	await ensureAccessGroups(db);
	const crewLead = await db.accessGroup.findFirstOrThrow({
		where: { seedKey: "crew-lead" },
	});
	await db.member.create({
		data: {
			id: `m-${crewLeadId}`,
			organizationId: WORKSPACE_ID,
			userId: crewLeadId,
			role: "member",
			groupId: crewLead.id,
			createdAt: new Date(),
		},
	});
});

afterAll(async () => {
	await db.member.deleteMany({ where: { userId: crewLeadId } });
	await db.user.deleteMany({ where: { id: crewLeadId } });
});

async function expectTRPCError(
	run: () => unknown,
	code: TRPCError["code"],
	message: string,
) {
	try {
		await run();
		throw new Error("expected TRPCError");
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe(code);
		expect((error as TRPCError).message).toBe(message);
	}
}

describe("AccessMiddleware", () => {
	test("refuses a procedure with no meta", async () => {
		await expectTRPCError(
			() =>
				middleware.use({
					ctx: { user: { id: crewLeadId } },
					meta: undefined,
					path: "invoices.list",
					next: noopNext,
				} as never),
			"INTERNAL_SERVER_ERROR",
			"Procedure invoices.list has no access tag.",
		);
	});

	test("refuses FIELD surface on a non-field tag", async () => {
		await expectTRPCError(
			() =>
				middleware.use({
					ctx: { user: { id: crewLeadId } },
					meta: access("contacts", "VIEW"),
					path: "contacts.list",
					next: noopNext,
				} as never),
			"FORBIDDEN",
			"Field mode can't use this.",
		);
	});
});
