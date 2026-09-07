import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { ProjectsService } from "../src/projects/projects.service";

const suffix = process.env.TEST_RUN_ID ?? "projects-spec";

const service = new ProjectsService(db);

let userId: string;
let dealId: string;

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
});

afterAll(async () => {
	await db.projectTask.deleteMany({
		where: { project: { dealId } },
	});
	await db.project.deleteMany({ where: { dealId } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("ProjectsService", () => {
	it("creates a project and returns it with empty tasks from byId", async () => {
		const created = await service.create(
			{ dealId, name: `Project ${suffix}`, startDate: new Date() },
			userId,
		);

		const found = await service.byId(created.id);

		expect(found.id).toBe(created.id);
		expect(found.name).toBe(`Project ${suffix}`);
		expect(found.tasks).toEqual([]);
	});

	it("assigns increasing sortOrder to tasks created on the same day", async () => {
		const project = await service.create(
			{ dealId, name: `Sort project ${suffix}`, startDate: new Date() },
			userId,
		);

		const startDay = new Date("2026-09-10T00:00:00.000Z");
		const endDay = new Date("2026-09-11T00:00:00.000Z");

		const first = await service.taskCreate({
			projectId: project.id,
			name: "First",
			startDay,
			endDay,
		});
		const second = await service.taskCreate({
			projectId: project.id,
			name: "Second",
			startDay,
			endDay,
		});
		const third = await service.taskCreate({
			projectId: project.id,
			name: "Third",
			startDay,
			endDay,
		});

		expect(first.sortOrder).toBe(0);
		expect(second.sortOrder).toBe(1);
		expect(third.sortOrder).toBe(2);
	});

	it("orders byId tasks by startDay then sortOrder", async () => {
		const project = await service.create(
			{ dealId, name: `Order project ${suffix}`, startDate: new Date() },
			userId,
		);

		const laterDay = new Date("2026-09-15T00:00:00.000Z");
		const earlierDay = new Date("2026-09-08T00:00:00.000Z");

		await service.taskCreate({
			projectId: project.id,
			name: "Later",
			startDay: laterDay,
			endDay: laterDay,
		});
		await service.taskCreate({
			projectId: project.id,
			name: "Earlier",
			startDay: earlierDay,
			endDay: earlierDay,
		});
		await service.taskCreate({
			projectId: project.id,
			name: "Unscheduled",
			endDay: null,
		});

		const found = await service.byId(project.id);

		expect(found.tasks.map((task) => task.name)).toEqual([
			"Earlier",
			"Later",
			"Unscheduled",
		]);
		expect(found.tasks.every((task) => "crew" in task)).toBe(true);
	});

	it("reorders tasks on move, including moving to unscheduled", async () => {
		const project = await service.create(
			{ dealId, name: `Move project ${suffix}`, startDate: new Date() },
			userId,
		);

		const startDay = new Date("2026-09-11T00:00:00.000Z");
		const otherStartDay = new Date("2026-09-12T00:00:00.000Z");

		const task0 = await service.taskCreate({
			projectId: project.id,
			name: "Task 0",
			startDay,
			endDay: startDay,
		});
		await service.taskCreate({
			projectId: project.id,
			name: "Task 1",
			startDay,
			endDay: startDay,
		});
		const task2 = await service.taskCreate({
			projectId: project.id,
			name: "Task 2",
			startDay,
			endDay: startDay,
		});

		await service.taskMove({
			id: task2.id,
			startDay,
			endDay: startDay,
			sortOrder: 0,
		});

		const afterFirstMove = await service.byId(project.id);
		const dayTasks = afterFirstMove.tasks
			.filter((task) => task.startDay !== null)
			.sort((a, b) => a.sortOrder - b.sortOrder);

		expect(dayTasks.map((task) => task.name)).toEqual([
			"Task 2",
			"Task 0",
			"Task 1",
		]);
		expect(dayTasks.map((task) => task.sortOrder)).toEqual([0, 1, 2]);

		await service.taskMove({
			id: task0.id,
			startDay: otherStartDay,
			endDay: otherStartDay,
			sortOrder: 0,
		});

		const afterOtherDayMove = await service.byId(project.id);
		const movedToOtherDay = afterOtherDayMove.tasks.find(
			(task) => task.id === task0.id,
		);
		expect(movedToOtherDay?.startDay).toEqual(otherStartDay);
		expect(movedToOtherDay?.sortOrder).toBe(0);

		const remainingOnFirstDay = afterOtherDayMove.tasks
			.filter(
				(task) =>
					task.startDay !== null &&
					task.startDay.getTime() === startDay.getTime(),
			)
			.sort((a, b) => a.sortOrder - b.sortOrder);

		expect(remainingOnFirstDay.map((task) => task.name)).toEqual([
			"Task 2",
			"Task 1",
		]);
		expect(remainingOnFirstDay.map((task) => task.sortOrder)).toEqual([0, 1]);

		await service.taskMove({
			id: task0.id,
			startDay: null,
			endDay: null,
			sortOrder: 0,
		});

		const afterUnscheduledMove = await service.byId(project.id);
		const unscheduled = afterUnscheduledMove.tasks.find(
			(task) => task.id === task0.id,
		);
		expect(unscheduled?.startDay).toBeNull();
		expect(unscheduled?.endDay).toBeNull();
		expect(unscheduled?.sortOrder).toBe(0);
	});

	it("reports taskCounts in list and updates them on status change", async () => {
		const project = await service.create(
			{ dealId, name: `Counts project ${suffix}`, startDate: new Date() },
			userId,
		);

		const task = await service.taskCreate({
			projectId: project.id,
			name: "Countable 1",
			endDay: null,
		});
		await service.taskCreate({
			projectId: project.id,
			name: "Countable 2",
			endDay: null,
		});
		await service.taskCreate({
			projectId: project.id,
			name: "Countable 3",
			endDay: null,
		});

		const listBefore = await service.list({
			dealId,
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 25,
		});
		const rowBefore = listBefore.rows.find((row) => row.id === project.id);

		expect(rowBefore?.taskCounts).toEqual({ total: 3, done: 0 });

		await service.taskUpdate({ id: task.id, status: "DONE" });

		const listAfter = await service.list({
			dealId,
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 25,
		});
		const rowAfter = listAfter.rows.find((row) => row.id === project.id);

		expect(rowAfter?.taskCounts).toEqual({ total: 3, done: 1 });
	});

	it("cascades the deletion of a deal to its project and tasks", async () => {
		const secondDeal = await db.deal.create({
			data: {
				id: `deal-cascade-${suffix}`,
				name: `Cascade Deal ${suffix}`,
				ownerId: userId,
			},
			select: { id: true },
		});

		const project = await service.create(
			{
				dealId: secondDeal.id,
				name: `Cascade project ${suffix}`,
				startDate: new Date(),
			},
			userId,
		);
		await service.taskCreate({
			projectId: project.id,
			name: "Cascade task",
			endDay: null,
		});

		await db.deal.delete({ where: { id: secondDeal.id } });

		const projectCount = await db.project.count({
			where: { id: project.id },
		});
		const taskCount = await db.projectTask.count({
			where: { projectId: project.id },
		});

		expect(projectCount).toBe(0);
		expect(taskCount).toBe(0);
	});
});
