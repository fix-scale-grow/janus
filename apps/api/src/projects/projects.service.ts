import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate, resolveOrderBy } from "../trpc/list-input";
import { DAY_MS, PROJECTS } from "./projects.config";
import type {
	ProjectCalendarInput,
	ProjectCreateInput,
	ProjectListInput,
	ProjectMoveScheduleInput,
	ProjectUpdateInput,
	TaskCreateInput,
	TaskMoveInput,
	TaskUpdateInput,
} from "./projects.contracts";

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.ProjectOrderByWithRelationInput[]
> = {
	name: (dir) => [{ name: dir }],
	status: (dir) => [{ status: dir }],
	goalDate: (dir) => [{ goalDate: dir }],
	updatedAt: (dir) => [{ updatedAt: dir }],
};

function sameDay(a: Date | null, b: Date | null): boolean {
	if (a === null || b === null) return a === b;
	return a.getTime() === b.getTime();
}

const DEAL_SELECT = {
	id: true,
	name: true,
	contacts: {
		select: {
			contact: { select: { id: true, firstName: true, lastName: true } },
		},
		orderBy: { contact: { firstName: "asc" } },
	},
} as const;

type DealRow = {
	id: string;
	name: string;
	contacts: {
		contact: { id: string; firstName: string; lastName: string | null };
	}[];
};

function flattenDeal(deal: DealRow | null) {
	if (!deal) return null;
	return {
		id: deal.id,
		name: deal.name,
		contacts: deal.contacts.map(({ contact }) => contact),
	};
}

const ANCHOR_SELECT = {
	deal: { select: DEAL_SELECT },
	contact: { select: { id: true, firstName: true, lastName: true } },
	estimate: { select: { id: true, title: true } },
	invoice: { select: { id: true, number: true } },
} as const;

const LIST_SELECT = {
	id: true,
	name: true,
	status: true,
	startDate: true,
	goalDate: true,
	updatedAt: true,
	...ANCHOR_SELECT,
	tasks: { select: { status: true } },
} as const;

@Injectable()
export class ProjectsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: ProjectListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total] = await Promise.all([
			this.db.project.findMany({
				where,
				orderBy: resolveOrderBy(input, SORTABLE, [{ updatedAt: "desc" }]),
				skip,
				take,
				select: LIST_SELECT,
			}),
			this.db.project.count({ where }),
		]);

		return {
			rows: rows.map(({ tasks, deal, ...row }) => ({
				...row,
				deal: flattenDeal(deal),
				taskCounts: {
					total: tasks.length,
					done: tasks.filter((task) => task.status === "DONE").length,
				},
			})),
			total,
			facetCounts: {},
		};
	}

	async calendarRange(input: ProjectCalendarInput) {
		const rows = await this.db.project.findMany({
			where: {
				...(input.status ? { status: input.status } : {}),
				AND: [
					{
						OR: [
							{ startDate: { lte: input.to } },
							{ tasks: { some: { startDay: { lte: input.to } } } },
						],
					},
					{
						OR: [
							{ goalDate: { gte: input.from } },
							{ goalDate: null },
							{ tasks: { some: { endDay: { gte: input.from } } } },
						],
					},
				],
			},
			select: {
				id: true,
				name: true,
				status: true,
				startDate: true,
				goalDate: true,
				deal: { select: DEAL_SELECT },
				contact: { select: { id: true, firstName: true, lastName: true } },
			},
		});

		const extents = await this.db.projectTask.groupBy({
			by: ["projectId"],
			where: {
				projectId: { in: rows.map((row) => row.id) },
				OR: [{ startDay: { not: null } }, { endDay: { not: null } }],
			},
			_min: { startDay: true },
			_max: { endDay: true },
		});
		const extentByProject = new Map(
			extents.map((extent) => [
				extent.projectId,
				{ firstStart: extent._min.startDay, lastEnd: extent._max.endDay },
			]),
		);

		return rows
			.map(({ deal, ...row }) => {
				const extent = extentByProject.get(row.id);
				const startDate = extent?.firstStart ?? row.startDate;
				const endCandidates = [row.goalDate, extent?.lastEnd].filter(
					(value): value is Date => value !== null && value !== undefined,
				);
				const lastCandidate =
					endCandidates.length > 0
						? new Date(
								Math.max(...endCandidates.map((value) => value.getTime())),
							)
						: startDate;
				const endDate =
					lastCandidate.getTime() < startDate.getTime()
						? startDate
						: lastCandidate;
				return { ...row, deal: flattenDeal(deal), startDate, endDate };
			})
			.filter(
				(row) =>
					row.endDate.getTime() >= input.from.getTime() &&
					row.startDate.getTime() <= input.to.getTime(),
			)
			.sort(
				(a, b) =>
					a.startDate.getTime() - b.startDate.getTime() ||
					a.name.localeCompare(b.name),
			);
	}

	async byId(id: string) {
		const row = await this.db.project.findUnique({
			where: { id },
			include: {
				...ANCHOR_SELECT,
				tasks: {
					orderBy: [{ startDay: "asc" }, { sortOrder: "asc" }],
					include: {
						assignee: { select: { id: true, name: true, image: true } },
						crew: { select: { id: true, name: true, color: true } },
					},
				},
			},
		});

		if (!row) {
			throw new NotFoundException(`No project with id ${id}.`);
		}

		return { ...row, deal: flattenDeal(row.deal) };
	}

	async create(input: ProjectCreateInput, userId: string) {
		if (input.dealId) await this.ensureLinked("deal", input.dealId);
		if (input.contactId) await this.ensureLinked("contact", input.contactId);

		return this.db.project.create({
			data: {
				dealId: input.dealId ?? null,
				contactId: input.contactId ?? null,
				name: input.name,
				goal: input.goal,
				startDate: input.startDate,
				goalDate: input.goalDate,
				createdById: userId,
			},
		});
	}

	async update(input: ProjectUpdateInput) {
		const { id, ...data } = input;
		if (typeof data.dealId === "string") {
			await this.ensureLinked("deal", data.dealId);
		}
		if (typeof data.contactId === "string") {
			await this.ensureLinked("contact", data.contactId);
		}
		if (typeof data.estimateId === "string") {
			await this.ensureLinked("estimate", data.estimateId);
		}
		if (typeof data.invoiceId === "string") {
			await this.ensureLinked("invoice", data.invoiceId);
		}
		try {
			return await this.db.project.update({
				where: { id },
				data,
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	private async ensureLinked(
		model: "deal" | "contact" | "estimate" | "invoice",
		id: string,
	) {
		const row =
			model === "deal"
				? await this.db.deal.findUnique({ where: { id }, select: { id: true } })
				: model === "contact"
					? await this.db.contact.findUnique({
							where: { id },
							select: { id: true },
						})
					: model === "estimate"
						? await this.db.estimate.findUnique({
								where: { id },
								select: { id: true },
							})
						: await this.db.invoice.findUnique({
								where: { id },
								select: { id: true },
							});
		if (!row) {
			throw new NotFoundException(`No ${model} with id ${id}.`);
		}
	}

	async moveSchedule(input: ProjectMoveScheduleInput) {
		return this.db.$transaction(async (tx) => {
			const project = await tx.project.findUnique({
				where: { id: input.id },
				select: { id: true, startDate: true, goalDate: true },
			});
			if (!project) {
				throw new NotFoundException(`No project with id ${input.id}.`);
			}

			const shift = (value: Date): Date =>
				new Date(value.getTime() + input.deltaDays * DAY_MS);

			await tx.$executeRaw`
				UPDATE "project_task"
				SET "startDay" = "startDay" + ${input.deltaDays} * interval '1 day',
					"endDay" = "endDay" + ${input.deltaDays} * interval '1 day',
					"updatedAt" = now()
				WHERE "projectId" = ${project.id}
					AND ("startDay" IS NOT NULL OR "endDay" IS NOT NULL)
			`;

			return tx.project.update({
				where: { id: project.id },
				data: {
					startDate: shift(project.startDate),
					...(project.goalDate ? { goalDate: shift(project.goalDate) } : {}),
				},
			});
		});
	}

	async remove(id: string) {
		try {
			return await this.db.project.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async taskCreate(input: TaskCreateInput) {
		return this.db.$transaction(async (tx) => {
			const count = await tx.projectTask.count({
				where: { projectId: input.projectId },
			});
			if (count >= PROJECTS.task.max) {
				throw new BadRequestException(
					`A project can have at most ${PROJECTS.task.max} tasks.`,
				);
			}

			const sibling = await tx.projectTask.findFirst({
				where: { projectId: input.projectId, startDay: input.startDay ?? null },
				orderBy: { sortOrder: "desc" },
				select: { sortOrder: true },
			});

			return tx.projectTask.create({
				data: {
					projectId: input.projectId,
					name: input.name,
					startDay: input.startDay,
					endDay: input.endDay,
					crewId: input.crewId,
					assigneeId: input.assigneeId,
					note: input.note,
					sortOrder: (sibling?.sortOrder ?? -1) + 1,
				},
			});
		});
	}

	async taskUpdate(input: TaskUpdateInput) {
		const { id, ...data } = input;
		try {
			return await this.db.projectTask.update({
				where: { id },
				data,
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async taskRemove(id: string) {
		try {
			return await this.db.projectTask.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async taskMove(input: TaskMoveInput) {
		return this.db.$transaction(async (tx) => {
			const task = await tx.projectTask.findUnique({
				where: { id: input.id },
				select: { id: true, projectId: true, startDay: true },
			});
			if (!task) {
				throw new NotFoundException(`No task with id ${input.id}.`);
			}

			const siblings = await tx.projectTask.findMany({
				where: {
					projectId: task.projectId,
					startDay: input.startDay,
					id: { not: task.id },
				},
				orderBy: { sortOrder: "asc" },
				select: { id: true, sortOrder: true },
			});

			const order = siblings.map((sibling) => sibling.id);
			const index = Math.min(Math.max(input.sortOrder, 0), order.length);
			order.splice(index, 0, task.id);

			const previousSortOrder = new Map(
				siblings.map((sibling) => [sibling.id, sibling.sortOrder]),
			);

			await Promise.all(
				order
					.filter(
						(id, sortOrder) =>
							id === task.id || previousSortOrder.get(id) !== sortOrder,
					)
					.map((id) =>
						tx.projectTask.update({
							where: { id },
							data:
								id === task.id
									? {
											startDay: input.startDay,
											endDay: input.endDay,
											sortOrder: order.indexOf(id),
										}
									: { sortOrder: order.indexOf(id) },
						}),
					),
			);

			if (!sameDay(task.startDay, input.startDay)) {
				const orphaned = await tx.projectTask.findMany({
					where: {
						projectId: task.projectId,
						startDay: task.startDay,
						id: { not: task.id },
					},
					orderBy: { sortOrder: "asc" },
					select: { id: true, sortOrder: true },
				});

				await Promise.all(
					orphaned
						.filter((sibling, sortOrder) => sibling.sortOrder !== sortOrder)
						.map((sibling) =>
							tx.projectTask.update({
								where: { id: sibling.id },
								data: { sortOrder: orphaned.indexOf(sibling) },
							}),
						),
				);
			}

			return tx.projectTask.findUniqueOrThrow({ where: { id: task.id } });
		});
	}

	async upcomingTasks() {
		const from = new Date();
		from.setUTCHours(0, 0, 0, 0);
		const to = new Date(from);
		to.setUTCDate(to.getUTCDate() + PROJECTS.upcoming.days);

		const rows = await this.db.projectTask.findMany({
			where: {
				startDay: { gte: from, lte: to },
				status: { in: ["TODO", "IN_PROGRESS"] },
			},
			orderBy: [{ startDay: "asc" }, { sortOrder: "asc" }],
			take: PROJECTS.upcoming.take,
			select: {
				id: true,
				name: true,
				startDay: true,
				crew: { select: { name: true } },
				project: {
					select: {
						id: true,
						name: true,
						deal: { select: { id: true, name: true } },
					},
				},
			},
		});

		return {
			tasks: rows.map((row) => ({
				id: row.id,
				name: row.name,
				startDay: row.startDay,
				crewName: row.crew?.name ?? null,
				project: { id: row.project.id, name: row.project.name },
				dealId: row.project.deal?.id ?? null,
				dealName: row.project.deal?.name ?? null,
			})),
		};
	}

	private buildWhere(input: ProjectListInput): Prisma.ProjectWhereInput {
		const where: Prisma.ProjectWhereInput = {
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.status ? { status: input.status } : {}),
		};

		const term = input.q.trim();
		if (term) {
			where.name = { contains: term, mode: "insensitive" };
		}

		return where;
	}

	private translate(error: unknown, id: string): unknown {
		if (error instanceof NotFoundException) {
			return error;
		}
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No record with id ${id}.`);
		}
		return error;
	}
}
