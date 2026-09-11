import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { ProjectsService } from "../src/projects/projects.service";

const suffix = process.env.TEST_RUN_ID ?? "projects-upcoming-spec";

const service = new ProjectsService(db);

let userId: string;
let dealId: string;
let projectId: string;
let crewId: string;
let tomorrowTaskId: string;
let nextWeekTaskId: string;

const tomorrow = new Date();
tomorrow.setUTCHours(0, 0, 0, 0);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

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

	const deal = await db.deal.create({
		data: {
			id: `deal-${suffix}`,
			name: `Deal ${suffix}`,
			ownerId: userId,
			stageId: stage.id,
		},
		select: { id: true },
	});
	dealId = deal.id;

	const crew = await db.crew.create({
		data: { name: `Crew ${suffix}`, color: "var(--chart-1)" },
		select: { id: true },
	});
	crewId = crew.id;

	const project = await service.create(
		{ dealId, name: `Project ${suffix}`, startDate: new Date() },
		userId,
	);
	projectId = project.id;

	const farOut = new Date();
	farOut.setUTCHours(0, 0, 0, 0);
	farOut.setUTCDate(farOut.getUTCDate() + 30);

	const tomorrowTask = await service.taskCreate({
		projectId,
		name: `Upcoming ${suffix}`,
		startDay: tomorrow,
		endDay: tomorrow,
		crewId,
	});
	tomorrowTaskId = tomorrowTask.id;

	const doneTomorrowTask = await service.taskCreate({
		projectId,
		name: `Done ${suffix}`,
		startDay: tomorrow,
		endDay: tomorrow,
	});
	await service.taskUpdate({ id: doneTomorrowTask.id, status: "DONE" });

	await service.taskCreate({
		projectId,
		name: `Far out ${suffix}`,
		startDay: farOut,
		endDay: farOut,
	});

	const nextWeek = new Date();
	nextWeek.setUTCHours(0, 0, 0, 0);
	nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

	const nextWeekTask = await service.taskCreate({
		projectId,
		name: `Next week ${suffix}`,
		startDay: nextWeek,
		endDay: nextWeek,
	});
	nextWeekTaskId = nextWeekTask.id;
});

afterAll(async () => {
	await db.projectTask.deleteMany({ where: { projectId } });
	await db.project.deleteMany({ where: { dealId } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.crew.deleteMany({ where: { id: crewId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("ProjectsService.upcomingTasks", () => {
	it("returns only TODO/IN_PROGRESS tasks starting within the next 14 days", async () => {
		const result = await service.upcomingTasks();
		const ids = result.tasks.map((task) => task.id);

		expect(ids).toContain(tomorrowTaskId);
		expect(ids.filter((id) => id === tomorrowTaskId).length).toBe(1);

		const found = result.tasks.find((task) => task.id === tomorrowTaskId);
		expect(found).toEqual({
			id: tomorrowTaskId,
			name: `Upcoming ${suffix}`,
			startDay: tomorrow,
			crewName: `Crew ${suffix}`,
			project: { id: projectId, name: `Project ${suffix}` },
			dealName: `Deal ${suffix}`,
		});
	});

	it("excludes DONE tasks and tasks starting beyond the window", async () => {
		const result = await service.upcomingTasks();
		const names = result.tasks.map((task) => task.name);

		expect(names).not.toContain(`Done ${suffix}`);
		expect(names).not.toContain(`Far out ${suffix}`);
	});

	it("orders by startDay ascending", async () => {
		const result = await service.upcomingTasks();
		const ids = result.tasks.map((task) => task.id);

		expect(ids.indexOf(tomorrowTaskId)).toBeLessThan(
			ids.indexOf(nextWeekTaskId),
		);
	});
});
