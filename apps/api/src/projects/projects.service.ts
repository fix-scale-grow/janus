import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate, resolveOrderBy } from "../trpc/list-input";
import { PROJECTS } from "./projects.config";
import type {
	ProjectCreateInput,
	ProjectListInput,
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

const LIST_SELECT = {
	id: true,
	name: true,
	status: true,
	startDate: true,
	goalDate: true,
	updatedAt: true,
	deal: {
		select: {
			id: true,
			name: true,
			company: { select: { id: true, name: true } },
		},
	},
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
			rows: rows.map(({ tasks, ...row }) => ({
				...row,
				taskCounts: {
					total: tasks.length,
					done: tasks.filter((task) => task.status === "DONE").length,
				},
			})),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string) {
		const row = await this.db.project.findUnique({
			where: { id },
			include: {
				deal: {
					select: {
						id: true,
						name: true,
						company: { select: { id: true, name: true } },
					},
				},
				tasks: {
					orderBy: [{ day: "asc" }, { sortOrder: "asc" }],
					include: {
						assignee: { select: { id: true, name: true, image: true } },
					},
				},
			},
		});

		if (!row) {
			throw new NotFoundException(`No project with id ${id}.`);
		}

		return row;
	}

	async create(input: ProjectCreateInput, userId: string) {
		const deal = await this.db.deal.findUnique({
			where: { id: input.dealId },
			select: { id: true },
		});
		if (!deal) {
			throw new NotFoundException(`No deal with id ${input.dealId}.`);
		}

		return this.db.project.create({
			data: {
				dealId: input.dealId,
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
		try {
			return await this.db.project.update({
				where: { id },
				data,
			});
		} catch (error) {
			throw this.translate(error, id);
		}
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
				where: { projectId: input.projectId, day: input.day ?? null },
				orderBy: { sortOrder: "desc" },
				select: { sortOrder: true },
			});

			return tx.projectTask.create({
				data: {
					projectId: input.projectId,
					name: input.name,
					day: input.day,
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
				select: { id: true, projectId: true, day: true },
			});
			if (!task) {
				throw new NotFoundException(`No task with id ${input.id}.`);
			}

			const siblings = await tx.projectTask.findMany({
				where: {
					projectId: task.projectId,
					day: input.day,
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
									? { day: input.day, sortOrder: order.indexOf(id) }
									: { sortOrder: order.indexOf(id) },
						}),
					),
			);

			if (!sameDay(task.day, input.day)) {
				const orphaned = await tx.projectTask.findMany({
					where: {
						projectId: task.projectId,
						day: task.day,
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
