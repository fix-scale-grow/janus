import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ensureWorkspaceMembership, WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { WorkspaceService } from "../src/workspace/workspace.service";

const suffix = process.env.TEST_RUN_ID ?? "workspace-spec";
const prefix = `spec_${suffix}`;
const ownerId = `${prefix}_owner`;

const workspace = new WorkspaceService(db, new AgentTriggerService(db));

async function expectRejects(
	promise: Promise<unknown>,
	match?: RegExp,
): Promise<void> {
	let caught: unknown;

	try {
		await promise;
	} catch (error) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(Error);
	if (match) expect((caught as Error).message).toMatch(match);
}

let before: {
	name: string;
	slug: string;
	website: string | null;
	brandColor: string | null;
	metadata: string | null;
};

let testStart: Date;

beforeAll(async () => {
	testStart = new Date();

	await db.user.upsert({
		where: { id: ownerId },
		create: { id: ownerId, name: "Brand Rep", email: `rep@${prefix}.test` },
		update: {},
	});

	await ensureWorkspaceMembership(ownerId);

	await db.member.update({
		where: {
			organizationId_userId: { organizationId: WORKSPACE_ID, userId: ownerId },
		},
		data: { role: "owner" },
	});

	before = await db.organization.findUniqueOrThrow({
		where: { id: WORKSPACE_ID },
		select: {
			name: true,
			slug: true,
			website: true,
			brandColor: true,
			metadata: true,
		},
	});
});

afterAll(async () => {
	await db.organization.update({ where: { id: WORKSPACE_ID }, data: before });
	await db.member.deleteMany({ where: { userId: ownerId } });
	await db.user.deleteMany({ where: { id: ownerId } });
	await db.agentTask.deleteMany({
		where: { kind: "workspace-profile", createdAt: { gte: testStart } },
	});
});

describe("workspace brandColor", () => {
	it("round-trips a normalized hex through update and get", async () => {
		const updated = await workspace.update(ownerId, {
			name: before.name,
			website: "acme.com",
			brandColor: "#0B5",
		});

		expect(updated.brandColor).toBe("#00bb55");

		const fetched = await workspace.get(ownerId);
		expect(fetched.brandColor).toBe("#00bb55");
	});

	it("rejects an invalid brand color", async () => {
		await expectRejects(
			workspace.update(ownerId, {
				name: before.name,
				website: "acme.com",
				brandColor: "not-a-color",
			}),
			/color/i,
		);
	});

	it("clears the brand color on an explicit null", async () => {
		await workspace.update(ownerId, {
			name: before.name,
			website: "acme.com",
			brandColor: "#006b4f",
		});

		const updated = await workspace.update(ownerId, {
			name: before.name,
			website: "acme.com",
			brandColor: null,
		});

		expect(updated.brandColor).toBeNull();
	});

	it("leaves the brand color untouched when omitted", async () => {
		await workspace.update(ownerId, {
			name: before.name,
			website: "acme.com",
			brandColor: "#123456",
		});

		const updated = await workspace.update(ownerId, {
			name: before.name,
			website: "acme.com",
		});

		expect(updated.brandColor).toBe("#123456");
	});
});
