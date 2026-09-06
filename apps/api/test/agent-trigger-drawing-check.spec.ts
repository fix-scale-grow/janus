import { describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";

type CreatedTask = {
	drawingId: string | null;
	kind: string;
	payload?: unknown;
};

function fakeDb(existing: CreatedTask[]) {
	const created: CreatedTask[] = [];

	const db = {
		agentTask: {
			findFirst: async (args: {
				where: {
					kind: string;
					drawingId?: string;
					payload?: { path: string[]; equals: string };
				};
			}) => {
				const match = [...existing, ...created].find((task) => {
					if (task.kind !== args.where.kind) return false;
					if (
						args.where.drawingId !== undefined &&
						task.drawingId !== args.where.drawingId
					) {
						return false;
					}
					if (args.where.payload) {
						const key = args.where.payload.path[0];
						const value = key
							? (task.payload as Record<string, unknown> | undefined)?.[key]
							: undefined;
						if (value !== args.where.payload.equals) return false;
					}
					return true;
				});
				return match ? { id: "task1" } : null;
			},
			create: async (args: { data: CreatedTask }) => {
				created.push(args.data);
				return { id: `task${created.length}` };
			},
		},
		$transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
			const tx = {
				...db,
				$queryRaw: async () => [{ locked: true }],
			};
			return fn(tx);
		},
	} as unknown as Db;

	return { db, created };
}

describe("estimateGenerated drawing-check dedupe", () => {
	it("skips a second enqueue for the same drawing and the same estimate", async () => {
		const { db, created } = fakeDb([
			{
				drawingId: "dr1",
				kind: "drawing-check",
				payload: { estimateId: "es1" },
			},
		]);

		await new AgentTriggerService(db).estimateGenerated(
			"dr1",
			"es1",
			"Another estimate was generated from this drawing.",
		);

		expect(created).toHaveLength(0);
	});

	it("enqueues a check when a different estimate is generated from the same drawing while one is pending", async () => {
		const { db, created } = fakeDb([
			{
				drawingId: "dr1",
				kind: "drawing-check",
				payload: { estimateId: "es1" },
			},
		]);

		await new AgentTriggerService(db).estimateGenerated(
			"dr1",
			"es2",
			"A second estimate was generated from this drawing.",
		);

		expect(created).toHaveLength(1);
		const payload = created[0]?.payload as { estimateId: string } | undefined;
		expect(payload?.estimateId).toBe("es2");
	});
});
