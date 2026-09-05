import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	measureSatellite,
	measureScene,
	parseDrawingScale,
	parseDrawingScene,
	quantityForUnit,
} from "@crm/drawings";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { paginate } from "../trpc/list-input";
import type {
	EstimateAddLineItemInput,
	EstimateCreateInput,
	EstimateGenerateFromDrawingInput,
	EstimateListInput,
	EstimateRenameInput,
	EstimateSetStatusInput,
	EstimateSetTierInput,
	EstimateUpdateLineItemInput,
} from "./estimates.contracts";
import { buildLineItems } from "./generate";

const LIST_SELECT = {
	id: true,
	title: true,
	status: true,
	currency: true,
	dealId: true,
	updatedAt: true,
	deal: { select: { name: true } },
	lineItems: {
		select: { quantity: true, priceBetterCents: true },
	},
} as const;

@Injectable()
export class EstimatesService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: EstimateListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total] = await Promise.all([
			this.db.estimate.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				skip,
				take,
				select: LIST_SELECT,
			}),
			this.db.estimate.count({ where }),
		]);

		return {
			rows: rows.map(({ deal, lineItems, ...row }) => ({
				...row,
				dealName: deal?.name ?? null,
				totalBetterCents: lineItems.reduce(
					(sum, item) =>
						sum + Math.round(Number(item.quantity) * item.priceBetterCents),
					0,
				),
				lineCount: lineItems.length,
			})),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string) {
		const row = await this.db.estimate.findUnique({
			where: { id },
			include: { lineItems: { orderBy: { sortOrder: "asc" } } },
		});

		if (!row) {
			throw new NotFoundException(`No estimate with id ${id}.`);
		}

		const totals = { goodCents: 0, betterCents: 0, bestCents: 0 };
		for (const item of row.lineItems) {
			const quantity = Number(item.quantity);
			totals.goodCents += Math.round(quantity * item.priceGoodCents);
			totals.betterCents += Math.round(quantity * item.priceBetterCents);
			totals.bestCents += Math.round(quantity * item.priceBestCents);
		}

		return { ...row, totals };
	}

	async create(input: EstimateCreateInput, userId: string) {
		const currency = await this.currencyFor(input.dealId);

		return this.db.estimate.create({
			data: {
				title: input.title ?? "Untitled estimate",
				dealId: input.dealId,
				contactId: input.contactId,
				currency,
				createdById: userId,
			},
		});
	}

	async rename(input: EstimateRenameInput) {
		try {
			return await this.db.estimate.update({
				where: { id: input.id },
				data: { title: input.title },
				select: { id: true, title: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async setStatus(input: EstimateSetStatusInput) {
		try {
			return await this.db.estimate.update({
				where: { id: input.id },
				data: { status: input.status },
				select: { id: true, status: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async setTier(input: EstimateSetTierInput) {
		try {
			return await this.db.estimate.update({
				where: { id: input.id },
				data: { selectedTier: input.tier },
				select: { id: true, selectedTier: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async delete(id: string) {
		try {
			return await this.db.estimate.delete({
				where: { id },
				select: { id: true, title: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async addLineItem(input: EstimateAddLineItemInput) {
		const estimate = await this.db.estimate.findUnique({
			where: { id: input.estimateId },
			select: { id: true },
		});
		if (!estimate) {
			throw new NotFoundException(`No estimate with id ${input.estimateId}.`);
		}

		if (input.serviceId) {
			const service = await this.db.service.findUnique({
				where: { id: input.serviceId },
			});
			if (!service) {
				throw new NotFoundException(`No service with id ${input.serviceId}.`);
			}

			const count = await this.db.estimateLineItem.count({
				where: { estimateId: input.estimateId },
			});

			return this.db.estimateLineItem.create({
				data: {
					estimateId: input.estimateId,
					serviceId: service.id,
					name: service.name,
					unit: service.unit,
					quantity: input.quantity,
					priceGoodCents: service.priceGoodCents ?? service.unitPriceCents,
					priceBetterCents: service.unitPriceCents,
					priceBestCents: service.priceBestCents ?? service.unitPriceCents,
					areaLabel: input.areaLabel,
					sortOrder: count,
				},
			});
		}

		if (!input.name || !input.unit) {
			throw new BadRequestException(
				"A line item needs a service, or a name and unit.",
			);
		}

		const count = await this.db.estimateLineItem.count({
			where: { estimateId: input.estimateId },
		});

		return this.db.estimateLineItem.create({
			data: {
				estimateId: input.estimateId,
				name: input.name,
				unit: input.unit,
				quantity: input.quantity,
				priceGoodCents: 0,
				priceBetterCents: 0,
				priceBestCents: 0,
				areaLabel: input.areaLabel,
				sortOrder: count,
			},
		});
	}

	async updateLineItem(input: EstimateUpdateLineItemInput) {
		try {
			return await this.db.estimateLineItem.update({
				where: { id: input.id },
				data: input.data,
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async removeLineItem(id: string) {
		try {
			return await this.db.estimateLineItem.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async generateFromDrawing(
		input: EstimateGenerateFromDrawingInput,
		userId: string,
	) {
		const drawing = await this.db.drawing.findUnique({
			where: { id: input.drawingId },
			include: { deal: { select: { currency: true } } },
		});

		if (!drawing) {
			throw new NotFoundException(`No drawing with id ${input.drawingId}.`);
		}

		const shapes = this.measureDrawing(drawing.scene, drawing.scale);
		const services = await this.db.service.findMany({
			where: { active: true },
		});
		const drafts = buildLineItems(shapes, services);

		return this.db.$transaction(async (tx) => {
			const estimate = await tx.estimate.create({
				data: {
					title: `${drawing.title} estimate`,
					dealId: drawing.dealId,
					contactId: drawing.contactId,
					drawingId: drawing.id,
					currency: drawing.deal?.currency ?? "USD",
					createdById: userId,
				},
			});

			if (drafts.length > 0) {
				await tx.estimateLineItem.createMany({
					data: drafts.map((draft) => ({
						estimateId: estimate.id,
						...draft,
					})),
				});
			}

			return { id: estimate.id };
		});
	}

	async resyncFromDrawing(id: string) {
		const estimate = await this.db.estimate.findUnique({
			where: { id },
			include: { lineItems: true },
		});

		if (!estimate) {
			throw new NotFoundException(`No estimate with id ${id}.`);
		}

		if (!estimate.drawingId) {
			throw new BadRequestException(
				"This estimate has no drawing to re-sync from.",
			);
		}

		const drawing = await this.db.drawing.findUnique({
			where: { id: estimate.drawingId },
		});

		if (!drawing) {
			throw new NotFoundException(`No drawing with id ${estimate.drawingId}.`);
		}

		const shapes = this.measureDrawing(drawing.scene, drawing.scale);
		const byScopeId = new Map(shapes.map((shape) => [shape.scopeId, shape]));

		const changed: {
			lineItemId: string;
			name: string;
			oldQuantity: number;
			newQuantity: number;
		}[] = [];

		await this.db.$transaction(async (tx) => {
			for (const item of estimate.lineItems) {
				if (!item.scopeId) continue;
				const shape = byScopeId.get(item.scopeId);
				if (!shape) continue;

				const newQuantity = quantityForUnit(item.unit, shape.quantity);
				if (newQuantity === null) continue;

				const oldQuantity = Number(item.quantity);
				if (Math.round(oldQuantity * 100) === Math.round(newQuantity * 100)) {
					continue;
				}

				await tx.estimateLineItem.update({
					where: { id: item.id },
					data: { quantity: newQuantity },
				});

				changed.push({
					lineItemId: item.id,
					name: item.name,
					oldQuantity,
					newQuantity,
				});
			}
		});

		return { changed };
	}

	private measureDrawing(scene: unknown, scale: unknown) {
		const parsedScene = parseDrawingScene(scene);
		const parsedScale = parseDrawingScale(scale);
		return [
			...measureScene(parsedScene, parsedScale),
			...measureSatellite(parsedScene.satellite?.features ?? []),
		];
	}

	private async currencyFor(dealId: string | undefined): Promise<string> {
		if (!dealId) return "USD";
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: { currency: true },
		});
		return deal?.currency ?? "USD";
	}

	private buildWhere(input: EstimateListInput): Prisma.EstimateWhereInput {
		const where: Prisma.EstimateWhereInput = {
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.status ? { status: input.status } : {}),
		};

		const term = input.q.trim();
		if (term) {
			where.title = { contains: term, mode: "insensitive" };
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
			return new NotFoundException(`No estimate with id ${id}.`);
		}
		return error;
	}
}
