import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ensureWorkspaceMembership, WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { WorkspaceService } from "../src/workspace/workspace.service";

const suffix = process.env.TEST_RUN_ID ?? "workspace-last-owner-spec";
const prefix = `spec_${suffix}`;
const ownerId = `${prefix}_owner`;

const workspace = new WorkspaceService(db, new AgentTriggerService(db));

let ownerMemberId: string;
let otherOwnerIds: string[] = [];

beforeAll(async () => {
	await db.user.upsert({
		where: { id: ownerId },
		create: { id: ownerId, name: "Sole Owner", email: `owner@${prefix}.test` },
		update: {},
	});

	await ensureWorkspaceMembership(ownerId);

	const member = await db.member.update({
		where: {
			organizationId_userId: { organizationId: WORKSPACE_ID, userId: ownerId },
		},
		data: { role: "owner" },
		select: { id: true },
	});
	ownerMemberId = member.id;

	const others = await db.member.findMany({
		where: {
			organizationId: WORKSPACE_ID,
			role: "owner",
			id: { not: ownerMemberId },
		},
		select: { id: true },
	});
	otherOwnerIds = others.map((row) => row.id);
});

afterAll(async () => {
	if (otherOwnerIds.length > 0) {
		await db.member.updateMany({
			where: { id: { in: otherOwnerIds } },
			data: { role: "owner" },
		});
	}
	await db.member.deleteMany({ where: { userId: ownerId } });
	await db.user.deleteMany({ where: { id: ownerId } });
});

describe("last-owner guard", () => {
	it("refuses to demote the sole remaining owner", async () => {
		try {
			if (otherOwnerIds.length > 0) {
				await db.member.updateMany({
					where: { id: { in: otherOwnerIds } },
					data: { role: "admin" },
				});
			}

			let caught: unknown;
			try {
				await workspace.setMemberRole(ownerId, {
					memberId: ownerMemberId,
					role: "admin",
				});
			} catch (error) {
				caught = error;
			}

			expect(caught).toBeInstanceOf(Error);
			expect((caught as Error).message).toBe(
				"The workspace needs an owner. Make someone else an owner first.",
			);

			const stillOwner = await db.member.findUniqueOrThrow({
				where: { id: ownerMemberId },
				select: { role: true },
			});
			expect(stillOwner.role).toBe("owner");
		} finally {
			if (otherOwnerIds.length > 0) {
				await db.member.updateMany({
					where: { id: { in: otherOwnerIds } },
					data: { role: "owner" },
				});
			}
		}
	});
});
