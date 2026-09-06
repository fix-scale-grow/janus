import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { DIRECT_KINDS, isDirectKind, PRIORITY } from "@crm/db/agent-tasks";
import { claimDue } from "../agent/lib/tasks";

const REASON = "lane-test";
const TEST_PRIORITY_OFFSET = 1_000_000;

const VISIBLE = { only: DIRECT_KINDS } as const;
const RESEARCH = { except: DIRECT_KINDS } as const;

async function clear() {
	await db.agentTask.deleteMany({ where: { reason: REASON } });
}

beforeEach(clear);
afterEach(clear);

async function queue(kind: string, priority: number) {
	return db.agentTask.create({
		data: {
			kind,
			reason: REASON,
			dueAt: new Date(Date.now() - 1000),
			priority: TEST_PRIORITY_OFFSET + priority,
			budget: 2,
		},
		select: { id: true },
	});
}

describe("dispatch lanes", () => {
	it("keeps a direct kind out of the research lane and a brief out of the visible one", async () => {
		const join = await queue("slack-channel-join", PRIORITY.slackJoin);
		const recheck = await queue("recheck", PRIORITY.recheck);

		const visible = await claimDue(10, VISIBLE);
		const research = await claimDue(10, RESEARCH);

		const visibleIds = visible.map((t) => t.id);
		const researchIds = research.map((t) => t.id);

		expect(visibleIds).toContain(join.id);
		expect(visibleIds).not.toContain(recheck.id);

		expect(researchIds).toContain(recheck.id);
		expect(researchIds).not.toContain(join.id);
	});

	it("a direct kind is never starved by a queue full of research", async () => {
		for (let i = 0; i < 30; i += 1) {
			await queue("identify", PRIORITY.identify);
		}

		const join = await queue("slack-channel-join", PRIORITY.slackJoin);

		const visible = await claimDue(5, VISIBLE);

		expect(visible.map((t) => t.id)).toContain(join.id);
	});

	it("takes the visible work in priority order", async () => {
		const people = await queue("slack-people-match", PRIORITY.slackPeople);
		const join = await queue("slack-channel-join", PRIORITY.slackJoin);

		const claimed = await claimDue(10, VISIBLE);
		const ordered = claimed
			.filter((t) => t.id === join.id || t.id === people.id)
			.map((t) => t.id);

		expect(ordered).toEqual([join.id, people.id]);
	});

	it("sends the who-are-we pass to the research lane, ahead of the contacts", async () => {
		const identify = await queue("identify", PRIORITY.identify);
		const us = await queue("workspace-profile", PRIORITY.workspace);

		const visible = await claimDue(10, VISIBLE);
		const research = await claimDue(10, RESEARCH);

		expect(visible.map((t) => t.id)).not.toContain(us.id);

		const ordered = research
			.filter((t) => t.id === us.id || t.id === identify.id)
			.map((t) => t.id);

		expect(ordered).toEqual([us.id, identify.id]);
	});

	it("leases the two lanes independently", async () => {
		const join = await queue("slack-channel-join", PRIORITY.slackJoin);

		await claimDue(10, VISIBLE);
		const again = await claimDue(10, RESEARCH);

		expect(again.map((t) => t.id)).not.toContain(join.id);
	});
});

describe("kind vocabulary", () => {
	it("agrees on which kinds skip the model", () => {
		expect(isDirectKind("slack-channel-join")).toBe(true);
		expect(isDirectKind("slack-people-match")).toBe(true);
		expect(isDirectKind("identify")).toBe(false);
		expect(isDirectKind("workspace-profile")).toBe(false);
	});

	it("puts what a rep sees first above what they have to click for", () => {
		expect(PRIORITY.slackJoin).toBeGreaterThan(PRIORITY.requested);
		expect(PRIORITY.requested).toBeGreaterThan(PRIORITY.fieldBackfill);
		expect(PRIORITY.fieldBackfill).toBeGreaterThan(PRIORITY.recheck);
	});
});
