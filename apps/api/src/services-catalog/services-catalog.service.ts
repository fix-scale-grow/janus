import { type Db, Prisma as PrismaNamespace } from "@crm/db";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate } from "../trpc/list-input";
import { ROOFING_SEED } from "./roofing-seed";
import type {
	ServiceCreateInput,
	ServiceListInput,
	ServiceUpdateInput,
} from "./services-catalog.contracts";

@Injectable()
export class ServicesCatalogService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: ServiceListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total] = await Promise.all([
			this.db.service.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.db.service.count({ where }),
		]);

		return { rows, total, facetCounts: {} };
	}

	async byId(id: string) {
		const row = await this.db.service.findUnique({ where: { id } });

		if (!row) {
			throw new NotFoundException(`No service with id ${id}.`);
		}

		return row;
	}

	async create(input: ServiceCreateInput) {
		return this.db.service.create({ data: input });
	}

	async update(input: ServiceUpdateInput) {
		try {
			return await this.db.service.update({
				where: { id: input.id },
				data: input.data,
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async delete(id: string) {
		try {
			return await this.db.service.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async seedRoofing() {
		const existing = await this.db.service.findMany({ select: { name: true } });
		const existingNames = new Set(
			existing.map((row) => row.name.toLowerCase()),
		);

		const candidates = ROOFING_SEED.filter(
			(seed) => !existingNames.has(seed.name.toLowerCase()),
		);

		let created = 0;

		for (const seed of candidates) {
			try {
				await this.db.service.create({
					data: { ...seed, trade: "roofing", active: true },
				});
				created += 1;
			} catch (error) {
				if (
					error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
					error.code === "P2002" &&
					seed.symbolId
				) {
					const { symbolId: _symbolId, ...withoutSymbol } = seed;
					await this.db.service.create({
						data: { ...withoutSymbol, trade: "roofing", active: true },
					});
					created += 1;
					continue;
				}
				throw error;
			}
		}

		return { created };
	}

	private buildWhere(input: ServiceListInput) {
		const where: NonNullable<
			Parameters<Db["service"]["findMany"]>[0]
		>["where"] = {
			...(input.trade ? { trade: input.trade } : {}),
			...(input.active !== undefined ? { active: input.active } : {}),
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
			return new NotFoundException(`No service with id ${id}.`);
		}
		return error;
	}
}
