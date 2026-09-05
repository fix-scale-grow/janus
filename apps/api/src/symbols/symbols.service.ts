import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate } from "../trpc/list-input";
import { ROOFING_SYMBOL_SEED } from "./roofing-symbol-seed";
import type {
	SymbolCreateInput,
	SymbolListInput,
	SymbolUpdateInput,
} from "./symbols.contracts";

const LIST_SELECT = {
	id: true,
	name: true,
	trade: true,
	elements: true,
	widthFt: true,
	heightFt: true,
	serviceId: true,
	active: true,
	sortOrder: true,
	createdAt: true,
	updatedAt: true,
	service: { select: { name: true } },
} as const;

@Injectable()
export class SymbolsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: SymbolListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total] = await Promise.all([
			this.db.symbol.findMany({
				where,
				orderBy: [{ trade: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
				skip,
				take,
				select: LIST_SELECT,
			}),
			this.db.symbol.count({ where }),
		]);

		return {
			rows: rows.map(({ service, ...row }) => ({
				...row,
				serviceName: service?.name ?? null,
			})),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string) {
		const row = await this.db.symbol.findUnique({ where: { id } });

		if (!row) {
			throw new NotFoundException(`No symbol with id ${id}.`);
		}

		return row;
	}

	async create(input: SymbolCreateInput) {
		return this.db.symbol.create({
			data: {
				...input,
				elements: input.elements as Prisma.InputJsonValue,
			} satisfies Prisma.SymbolUncheckedCreateInput,
		});
	}

	async update(input: SymbolUpdateInput) {
		try {
			return await this.db.symbol.update({
				where: { id: input.id },
				data: {
					...input.data,
					elements: input.data.elements as Prisma.InputJsonValue | undefined,
				} satisfies Prisma.SymbolUncheckedUpdateInput,
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async delete(id: string) {
		try {
			return await this.db.symbol.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async seedRoofing() {
		const existing = await this.db.symbol.findMany({ select: { name: true } });
		const existingNames = new Set(
			existing.map((row) => row.name.toLowerCase()),
		);

		const candidates = ROOFING_SYMBOL_SEED.filter(
			(seed) => !existingNames.has(seed.name.toLowerCase()),
		);

		if (candidates.length === 0) {
			return { created: 0 };
		}

		const serviceSymbolIds = candidates
			.map((seed) => seed.serviceSymbolId)
			.filter((value): value is string => Boolean(value));

		const services =
			serviceSymbolIds.length > 0
				? await this.db.service.findMany({
						where: { symbolId: { in: serviceSymbolIds } },
						select: { id: true, symbolId: true },
					})
				: [];

		const serviceIdBySymbolId = new Map(
			services
				.filter((service) => service.symbolId)
				.map((service) => [service.symbolId as string, service.id]),
		);

		let created = 0;

		for (const [index, seed] of candidates.entries()) {
			const { serviceSymbolId, ...rest } = seed;

			await this.db.symbol.create({
				data: {
					...rest,
					elements: rest.elements as Prisma.InputJsonValue,
					trade: "roofing",
					active: true,
					sortOrder: index,
					serviceId: serviceSymbolId
						? (serviceIdBySymbolId.get(serviceSymbolId) ?? null)
						: null,
				} satisfies Prisma.SymbolUncheckedCreateInput,
			});
			created += 1;
		}

		return { created };
	}

	private buildWhere(input: SymbolListInput) {
		const where: NonNullable<Parameters<Db["symbol"]["findMany"]>[0]>["where"] =
			{
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
			return new NotFoundException(`No symbol with id ${id}.`);
		}
		return error;
	}
}
