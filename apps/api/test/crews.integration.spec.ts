import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { CrewsService } from "../src/crews/crews.service";

const suffix = process.env.TEST_RUN_ID ?? "crews-spec";

const service = new CrewsService(db);

let userId: string;
let dealId: string;
let projectId: string;

beforeAll(async () => {
	const user = await db.user.create({
		data: {
			id: `user-${suffix}`,
			name: "Test Rep",
			email: `rep-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;

	const deal = await db.deal.create({
		data: {
			id: `deal-${suffix}`,
			name: `Deal ${suffix}`,
			ownerId: userId,
		},
		select: { id: true },
	});
	dealId = deal.id;

	const project = await db.project.create({
		data: {
			id: `project-${suffix}`,
			name: `Project ${suffix}`,
			dealId,
			createdById: userId,
			startDate: new Date(),
		},
		select: { id: true },
	});
	projectId = project.id;
});

afterAll(async () => {
	await db.projectTask.deleteMany({
		where: { project: { dealId } },
	});
	await db.project.deleteMany({ where: { dealId } });
	await db.crew.deleteMany({ where: { name: { startsWith: `Crew ${suffix}` } } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("CrewsService", () => {
	it("creates a crew and lists it with taskCount: 0", async () => {
		const created = await service.create({
			name: `Crew ${suffix}`,
			color: "red",
		});

		const rows = await service.list();

		const found = rows.find((row) => row.id === created.id);
		expect(found).toBeDefined();
		expect(found?.name).toBe(`Crew ${suffix}`);
		expect(found?.color).toBe("red");
		expect(found?.archived).toBe(false);
		expect(found?.taskCount).toBe(0);
	});

	it("lists crews ordered by archived (false first), then by name", async () => {
		const crew1 = await service.create({
			name: `Crew 1 ${suffix}`,
			color: "red",
		});
		const crew2 = await service.create({
			name: `Crew 2 ${suffix}`,
			color: "sky",
		});
		const crew3 = await service.create({
			name: `Crew 3 ${suffix}`,
			color: "green",
		});

		await service.update({
			id: crew2.id,
			archived: true,
		});

		const rows = await service.list();
		const filtered = rows.filter(
			(row) =>
				[crew1.id, crew2.id, crew3.id].includes(row.id) &&
				row.name.includes(suffix),
		);

		expect(filtered.map((row) => row.name)).toEqual([
			`Crew 1 ${suffix}`,
			`Crew 3 ${suffix}`,
			`Crew 2 ${suffix}`,
		]);
	});

	it("throws ConflictException when removing a crew with tasks", async () => {
		const crew = await service.create({
			name: `Crew with task ${suffix}`,
			color: "orange",
		});

		await db.projectTask.create({
			data: {
				id: `task-${suffix}`,
				projectId,
				name: "Task with crew",
				crewId: crew.id,
			},
		});

		let thrownError: unknown;
		try {
			await service.remove(crew.id);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeDefined();
		const err = thrownError as { message?: string };
		expect(err?.message).toBe(
			"Tasks still use this crew. Archive it instead.",
		);
	});

	it("removes a crew after detaching all tasks", async () => {
		const crew = await service.create({
			name: `Crew to remove ${suffix}`,
			color: "violet",
		});

		const task = await db.projectTask.create({
			data: {
				id: `detach-task-${suffix}`,
				projectId,
				name: "Task to detach",
				crewId: crew.id,
			},
			select: { id: true },
		});

		await db.projectTask.update({
			where: { id: task.id },
			data: { crewId: null },
		});

		const removed = await service.remove(crew.id);

		expect(removed.id).toBe(crew.id);
		expect(removed.name).toBe(`Crew to remove ${suffix}`);
	});

	it("updates crew and keeps archived state across roundtrips", async () => {
		const crew = await service.create({
			name: `Crew to update ${suffix}`,
			color: "indigo",
		});

		const updated = await service.update({
			id: crew.id,
			archived: true,
			name: `Crew updated ${suffix}`,
		});

		expect(updated.archived).toBe(true);
		expect(updated.name).toBe(`Crew updated ${suffix}`);

		const rows = await service.list();
		const found = rows.find((row) => row.id === crew.id);
		expect(found?.archived).toBe(true);
	});
});
