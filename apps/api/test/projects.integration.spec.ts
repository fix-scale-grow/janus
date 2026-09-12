import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { NotFoundException } from "@nestjs/common";
import { ProjectsService } from "../src/projects/projects.service";

const suffix = process.env.TEST_RUN_ID ?? "projects-spec";

const service = new ProjectsService(db);

let userId: string;
let dealId: string;
let entryStageId: string;

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

	const stage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});
	entryStageId = stage.id;

	const deal = await db.deal.create({
		data: {
			id: `deal-${suffix}`,
			name: `Deal ${suffix}`,
			ownerId: userId,
			stageId: entryStageId,
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

	it("returns calendar rows for projects overlapping the range", async () => {
		const from = new Date("2027-03-01T00:00:00.000Z");
		const to = new Date("2027-03-31T00:00:00.000Z");

		const spanning = await service.create(
			{
				dealId,
				name: `Cal spanning ${suffix}`,
				startDate: new Date("2027-02-20T00:00:00.000Z"),
				goalDate: new Date("2027-03-05T00:00:00.000Z"),
			},
			userId,
		);
		const before = await service.create(
			{
				dealId,
				name: `Cal before ${suffix}`,
				startDate: new Date("2027-01-01T00:00:00.000Z"),
				goalDate: new Date("2027-02-01T00:00:00.000Z"),
			},
			userId,
		);
		const after = await service.create(
			{
				dealId,
				name: `Cal after ${suffix}`,
				startDate: new Date("2027-04-10T00:00:00.000Z"),
				goalDate: new Date("2027-04-20T00:00:00.000Z"),
			},
			userId,
		);

		const rows = await service.calendarRange({ from, to });
		const ids = rows.map((row) => row.id);

		expect(ids).toContain(spanning.id);
		expect(ids).not.toContain(before.id);
		expect(ids).not.toContain(after.id);

		const found = rows.find((row) => row.id === spanning.id);
		expect(found?.endDate).toEqual(new Date("2027-03-05T00:00:00.000Z"));
		expect(found?.deal.id).toBe(dealId);
	});

	it("falls back to the last scheduled task end when there is no goal date", async () => {
		const from = new Date("2027-05-01T00:00:00.000Z");
		const to = new Date("2027-05-31T00:00:00.000Z");

		const project = await service.create(
			{
				dealId,
				name: `Cal taskend ${suffix}`,
				startDate: new Date("2027-04-25T00:00:00.000Z"),
			},
			userId,
		);
		await service.taskCreate({
			projectId: project.id,
			name: "Early",
			startDay: new Date("2027-04-26T00:00:00.000Z"),
			endDay: new Date("2027-04-28T00:00:00.000Z"),
		});
		await service.taskCreate({
			projectId: project.id,
			name: "Late",
			startDay: new Date("2027-05-02T00:00:00.000Z"),
			endDay: new Date("2027-05-04T00:00:00.000Z"),
		});

		const rows = await service.calendarRange({ from, to });
		const found = rows.find((row) => row.id === project.id);

		expect(found?.endDate).toEqual(new Date("2027-05-04T00:00:00.000Z"));
	});

	it("excludes a goal-less project whose start and tasks all end before the range", async () => {
		const from = new Date("2027-07-01T00:00:00.000Z");
		const to = new Date("2027-07-31T00:00:00.000Z");

		const project = await service.create(
			{
				dealId,
				name: `Cal stale ${suffix}`,
				startDate: new Date("2027-06-01T00:00:00.000Z"),
			},
			userId,
		);
		await service.taskCreate({
			projectId: project.id,
			name: "Done early",
			startDay: new Date("2027-06-02T00:00:00.000Z"),
			endDay: new Date("2027-06-03T00:00:00.000Z"),
		});

		const rows = await service.calendarRange({ from, to });

		expect(rows.map((row) => row.id)).not.toContain(project.id);
	});

	it("uses the start date alone for a goal-less project with no scheduled tasks", async () => {
		const from = new Date("2027-08-01T00:00:00.000Z");
		const to = new Date("2027-08-31T00:00:00.000Z");

		const project = await service.create(
			{
				dealId,
				name: `Cal bare ${suffix}`,
				startDate: new Date("2027-08-15T00:00:00.000Z"),
			},
			userId,
		);

		const rows = await service.calendarRange({ from, to });
		const found = rows.find((row) => row.id === project.id);

		expect(found?.endDate).toEqual(new Date("2027-08-15T00:00:00.000Z"));
	});

	it("filters the calendar by status", async () => {
		const from = new Date("2027-09-01T00:00:00.000Z");
		const to = new Date("2027-09-30T00:00:00.000Z");

		const active = await service.create(
			{
				dealId,
				name: `Cal active ${suffix}`,
				startDate: new Date("2027-09-10T00:00:00.000Z"),
			},
			userId,
		);
		const held = await service.create(
			{
				dealId,
				name: `Cal held ${suffix}`,
				startDate: new Date("2027-09-10T00:00:00.000Z"),
			},
			userId,
		);
		await service.update({ id: held.id, status: "ON_HOLD" });

		const rows = await service.calendarRange({ from, to, status: "ACTIVE" });
		const ids = rows.map((row) => row.id);

		expect(ids).toContain(active.id);
		expect(ids).not.toContain(held.id);
	});

	it("clamps the end date to the start date when the goal precedes it", async () => {
		const from = new Date("2027-10-01T00:00:00.000Z");
		const to = new Date("2027-10-31T00:00:00.000Z");

		const project = await service.create(
			{
				dealId,
				name: `Cal clamp ${suffix}`,
				startDate: new Date("2027-10-20T00:00:00.000Z"),
				goalDate: new Date("2027-10-05T00:00:00.000Z"),
			},
			userId,
		);

		const rows = await service.calendarRange({ from, to });
		const found = rows.find((row) => row.id === project.id);

		expect(found?.endDate).toEqual(new Date("2027-10-20T00:00:00.000Z"));
	});

	it("derives the calendar span from scheduled tasks when they exist", async () => {
		const from = new Date("2028-01-01T00:00:00.000Z");
		const to = new Date("2028-01-31T00:00:00.000Z");

		const project = await service.create(
			{
				dealId,
				name: `Cal derived ${suffix}`,
				startDate: new Date("2028-01-08T00:00:00.000Z"),
			},
			userId,
		);
		await service.taskCreate({
			projectId: project.id,
			name: "First job",
			startDay: new Date("2028-01-15T00:00:00.000Z"),
			endDay: new Date("2028-01-17T00:00:00.000Z"),
		});
		await service.taskCreate({
			projectId: project.id,
			name: "Second job",
			startDay: new Date("2028-01-25T00:00:00.000Z"),
			endDay: new Date("2028-01-25T00:00:00.000Z"),
		});

		const rows = await service.calendarRange({ from, to });
		const found = rows.find((row) => row.id === project.id);

		expect(found?.startDate).toEqual(new Date("2028-01-15T00:00:00.000Z"));
		expect(found?.endDate).toEqual(new Date("2028-01-25T00:00:00.000Z"));
	});

	it("extends the calendar end past the goal when tasks run later", async () => {
		const from = new Date("2028-02-01T00:00:00.000Z");
		const to = new Date("2028-02-28T00:00:00.000Z");

		const project = await service.create(
			{
				dealId,
				name: `Cal pastgoal ${suffix}`,
				startDate: new Date("2028-02-05T00:00:00.000Z"),
				goalDate: new Date("2028-02-15T00:00:00.000Z"),
			},
			userId,
		);
		await service.taskCreate({
			projectId: project.id,
			name: "Overrun",
			startDay: new Date("2028-02-10T00:00:00.000Z"),
			endDay: new Date("2028-02-20T00:00:00.000Z"),
		});

		const rows = await service.calendarRange({ from, to });
		const found = rows.find((row) => row.id === project.id);

		expect(found?.startDate).toEqual(new Date("2028-02-10T00:00:00.000Z"));
		expect(found?.endDate).toEqual(new Date("2028-02-20T00:00:00.000Z"));
	});

	it("returns the deal contacts on list, byId and calendar rows", async () => {
		const contact = await db.contact.create({
			data: {
				id: `contact-${suffix}`,
				firstName: "Casey",
				lastName: "Client",
				email: `casey-${suffix}@example.test`,
			},
			select: { id: true },
		});
		await db.dealContact.create({
			data: { dealId, contactId: contact.id },
		});

		const project = await service.create(
			{
				dealId,
				name: `Client project ${suffix}`,
				startDate: new Date("2028-03-10T00:00:00.000Z"),
			},
			userId,
		);

		const found = await service.byId(project.id);
		expect(found.deal.contacts.map((row) => row.id)).toContain(contact.id);

		const listed = await service.list({
			dealId,
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 25,
		});
		const listedRow = listed.rows.find((row) => row.id === project.id);
		expect(listedRow?.deal.contacts[0]?.firstName).toBe("Casey");

		const calendar = await service.calendarRange({
			from: new Date("2028-03-01T00:00:00.000Z"),
			to: new Date("2028-03-31T00:00:00.000Z"),
		});
		const calendarRow = calendar.find((row) => row.id === project.id);
		expect(calendarRow?.deal.contacts[0]?.lastName).toBe("Client");

		await db.dealContact.deleteMany({ where: { contactId: contact.id } });
		await db.contact.delete({ where: { id: contact.id } });
	});

	it("shifts start, goal and scheduled tasks together on moveSchedule", async () => {
		const project = await service.create(
			{
				dealId,
				name: `Shift project ${suffix}`,
				startDate: new Date("2028-04-01T00:00:00.000Z"),
				goalDate: new Date("2028-04-10T00:00:00.000Z"),
			},
			userId,
		);
		const scheduled = await service.taskCreate({
			projectId: project.id,
			name: "Scheduled",
			startDay: new Date("2028-04-03T00:00:00.000Z"),
			endDay: new Date("2028-04-04T00:00:00.000Z"),
		});
		const unscheduled = await service.taskCreate({
			projectId: project.id,
			name: "Unscheduled",
			endDay: null,
		});

		const moved = await service.moveSchedule({
			id: project.id,
			deltaDays: 3,
		});

		expect(moved.startDate).toEqual(new Date("2028-04-04T00:00:00.000Z"));
		expect(moved.goalDate).toEqual(new Date("2028-04-13T00:00:00.000Z"));

		const after = await service.byId(project.id);
		const movedTask = after.tasks.find((task) => task.id === scheduled.id);
		expect(movedTask?.startDay).toEqual(new Date("2028-04-06T00:00:00.000Z"));
		expect(movedTask?.endDay).toEqual(new Date("2028-04-07T00:00:00.000Z"));

		const untouched = after.tasks.find((task) => task.id === unscheduled.id);
		expect(untouched?.startDay).toBeNull();
		expect(untouched?.endDay).toBeNull();
	});

	it("keeps a null goal on moveSchedule and rejects an unknown project", async () => {
		const project = await service.create(
			{
				dealId,
				name: `Shift goalless ${suffix}`,
				startDate: new Date("2028-05-01T00:00:00.000Z"),
			},
			userId,
		);

		const moved = await service.moveSchedule({
			id: project.id,
			deltaDays: -2,
		});
		expect(moved.startDate).toEqual(new Date("2028-04-29T00:00:00.000Z"));
		expect(moved.goalDate).toBeNull();

		try {
			await service.moveSchedule({ id: "missing-project", deltaDays: 1 });
			expect.unreachable("moveSchedule accepted an unknown project");
		} catch (error) {
			expect(error).toBeInstanceOf(NotFoundException);
		}
	});

	it("cascades the deletion of a deal to its project and tasks", async () => {
		const secondDeal = await db.deal.create({
			data: {
				id: `deal-cascade-${suffix}`,
				name: `Cascade Deal ${suffix}`,
				ownerId: userId,
				stageId: entryStageId,
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
