import { type Db, Prisma } from "@crm/db";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type { CrewCreateInput, CrewUpdateInput } from "./crews.contracts";

@Injectable()
export class CrewsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list() {
		const rows = await this.db.crew.findMany({
			orderBy: [{ archived: "asc" }, { name: "asc" }],
			include: { _count: { select: { tasks: true } } },
		});
		return rows.map(({ _count, ...crew }) => ({
			...crew,
			taskCount: _count.tasks,
		}));
	}

	async create(input: CrewCreateInput) {
		return this.db.crew.create({
			data: {
				name: input.name,
				color: input.color,
			},
		});
	}

	async update(input: CrewUpdateInput) {
		const { id, ...data } = input;
		try {
			return await this.db.crew.update({
				where: { id },
				data,
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async remove(id: string) {
		const count = await this.db.projectTask.count({ where: { crewId: id } });
		if (count > 0) {
			throw new ConflictException(
				"Tasks still use this crew. Archive it instead.",
			);
		}
		try {
			return await this.db.crew.delete({ where: { id } });
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	private translate(error: unknown, id: string): unknown {
		if (error instanceof NotFoundException) {
			return error;
		}
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No record with id ${id}.`);
		}
		return error;
	}
}
