import { type Db, Prisma as PrismaNamespace } from "@crm/db";
import { maskCents, moneyRefusalMessage } from "@crm/db/access-money";
import { type AccessPrincipal, hasMoney } from "@crm/db/access-policy";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { parseServiceModifier, type ServiceModifier } from "@crm/drawings";
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate } from "../trpc/list-input";
import { PITCH_MODIFIED_SERVICE_NAMES, ROOFING_SEED } from "./roofing-seed";
import type {
	ServiceCreateInput,
	ServiceListInput,
	ServiceUpdateInput,
} from "./services-catalog.contracts";

const PRICE_KEYS = [
	"unitPriceCents",
	"costCents",
	"priceGoodCents",
	"priceBestCents",
] as const;

function toJsonModifier(modifier: ServiceModifier | null | undefined) {
	if (modifier === undefined) return undefined;
	if (modifier === null) return PrismaNamespace.JsonNull;
	return modifier;
}

type ServiceRecord = { modifier: unknown } & Record<string, unknown>;

function presentService<T extends ServiceRecord>(
	row: T,
): Omit<T, "modifier"> & { modifier: ServiceModifier | null } {
	return { ...row, modifier: parseServiceModifier(row.modifier) };
}

@Injectable()
export class ServicesCatalogService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: ServiceListInput, p: AccessPrincipal) {
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

		return {
			rows: rows.map((row) =>
				maskCents(p, "prices", presentService(row), PRICE_KEYS),
			),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string, p: AccessPrincipal) {
		const row = await this.db.service.findUnique({ where: { id } });

		if (!row) {
			throw new NotFoundException(`No service with id ${id}.`);
		}

		return maskCents(p, "prices", presentService(row), PRICE_KEYS);
	}

	async create(input: ServiceCreateInput, p: AccessPrincipal) {
		this.assertCanEditPriceBook(p);
		const row = await this.db.service.create({
			data: { ...input, modifier: toJsonModifier(input.modifier) },
		});
		return presentService(row);
	}

	async update(input: ServiceUpdateInput, p: AccessPrincipal) {
		this.assertCanEditPriceBook(p);
		try {
			const row = await this.db.service.update({
				where: { id: input.id },
				data: {
					...input.data,
					modifier: toJsonModifier(input.data.modifier),
				},
			});
			return presentService(row);
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async delete(id: string, p: AccessPrincipal) {
		this.assertCanEditPriceBook(p);
		try {
			return await this.db.service.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async seedRoofing(p: AccessPrincipal) {
		this.assertCanEditPriceBook(p);
		return this.db.$transaction(async (tx) => {
			await lockIdempotencyKey(tx, "services-catalog:seed-roofing");

			const existing = await tx.service.findMany({
				select: { id: true, name: true, modifier: true },
			});
			const existingByName = new Map(
				existing.map((row) => [row.name.toLowerCase(), row]),
			);

			const candidates = ROOFING_SEED.filter(
				(seed) => !existingByName.has(seed.name.toLowerCase()),
			);

			let created = 0;

			for (const seed of candidates) {
				try {
					await tx.service.create({
						data: {
							...seed,
							trade: "roofing",
							active: true,
							modifier: toJsonModifier(seed.modifier),
						},
					});
					created += 1;
				} catch (error) {
					if (
						error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
						error.code === "P2002" &&
						seed.symbolId
					) {
						const { symbolId: _symbolId, ...withoutSymbol } = seed;
						await tx.service.create({
							data: {
								...withoutSymbol,
								trade: "roofing",
								active: true,
								modifier: toJsonModifier(withoutSymbol.modifier),
							},
						});
						created += 1;
						continue;
					}
					throw error;
				}
			}

			for (const name of PITCH_MODIFIED_SERVICE_NAMES) {
				const row = existingByName.get(name.toLowerCase());
				if (!row || row.modifier !== null) continue;
				const seed = ROOFING_SEED.find((candidate) => candidate.name === name);
				if (!seed?.modifier) continue;
				await tx.service.update({
					where: { id: row.id },
					data: { modifier: seed.modifier },
				});
			}

			return { created };
		});
	}

	private assertCanEditPriceBook(p: AccessPrincipal): void {
		if (hasMoney(p, "priceBook")) return;
		throw new ForbiddenException(
			moneyRefusalMessage(p, "edit the price book."),
		);
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
