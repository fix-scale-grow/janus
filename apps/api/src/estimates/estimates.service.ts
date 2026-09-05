import { DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
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
import { ContactsService } from "../contacts/contacts.service";
import { InjectDatabase } from "../database/database.constants";
import { MailerService } from "../mailer/mailer.service";
import { paginate, resolveOrderBy } from "../trpc/list-input";
import { renderEstimatePdf } from "./estimate-pdf";
import type {
	EstimateAddLineItemInput,
	EstimateAssignContactInput,
	EstimateCreateInput,
	EstimateGenerateFromDrawingInput,
	EstimateListInput,
	EstimateRenameInput,
	EstimateSendInput,
	EstimateSetStatusInput,
	EstimateSetTierInput,
	EstimateUpdateLineItemInput,
} from "./estimates.contracts";
import { buildLineItems } from "./generate";

const PDF_CONTACT_SELECT = {
	firstName: true,
	lastName: true,
	email: true,
	phone: true,
} as const;

const MAX_FILENAME_STEM = 80;

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.EstimateOrderByWithRelationInput[]
> = {
	title: (dir) => [{ title: dir }],
	status: (dir) => [{ status: dir }],
	updatedAt: (dir) => [{ updatedAt: dir }],
};

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
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly contacts: ContactsService,
		private readonly mailer: MailerService,
	) {}

	async list(input: EstimateListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total] = await Promise.all([
			this.db.estimate.findMany({
				where,
				orderBy: resolveOrderBy(input, SORTABLE, [{ updatedAt: "desc" }]),
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
			include: {
				lineItems: { orderBy: { sortOrder: "asc" } },
				contact: {
					select: { id: true, firstName: true, lastName: true, email: true },
				},
			},
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

		try {
			return await this.db.estimate.create({
				data: {
					title: input.title ?? "Untitled estimate",
					dealId: input.dealId,
					contactId: input.contactId,
					currency,
					createdById: userId,
				},
			});
		} catch (error) {
			throw this.translate(error);
		}
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
		const [services, symbols] = await Promise.all([
			this.db.service.findMany({ where: { active: true } }),
			this.db.symbol.findMany({ select: { id: true, serviceId: true } }),
		]);
		const drafts = buildLineItems(shapes, services, symbols);

		if (drafts.length === 0) {
			throw new BadRequestException(
				"Nothing on this drawing can be priced yet.",
			);
		}

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

			await tx.estimateLineItem.createMany({
				data: drafts.map((draft) => ({
					estimateId: estimate.id,
					...draft,
				})),
			});

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

	async assignContact(input: EstimateAssignContactInput) {
		const estimate = await this.db.estimate.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!estimate) {
			throw new NotFoundException(`No estimate with id ${input.id}.`);
		}

		let contactId: string;

		if (input.contactId) {
			const contact = await this.db.contact.findUnique({
				where: { id: input.contactId },
				select: { id: true },
			});
			if (!contact) {
				throw new NotFoundException(`No contact with id ${input.contactId}.`);
			}
			contactId = contact.id;
		} else if (input.newContact) {
			const [firstName, ...rest] = input.newContact.name.trim().split(/\s+/);
			const created = await this.contacts.create({
				firstName: firstName ?? input.newContact.name.trim(),
				lastName: rest.length > 0 ? rest.join(" ") : undefined,
				email: input.newContact.email,
				phone: input.newContact.phone,
			});
			contactId = created.id;
		} else {
			throw new BadRequestException(
				"Choose an existing contact, or add a new one.",
			);
		}

		try {
			return await this.db.estimate.update({
				where: { id: input.id },
				data: { contactId },
				select: { id: true, contactId: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async document(id: string): Promise<{ filename: string; base64: string }> {
		const estimate = await this.loadForPdf(id);
		const workspaceName = await this.workspaceName();
		const buffer = await renderEstimatePdf(estimate, workspaceName);

		return {
			filename: `${this.filenameStem(estimate.title)}.pdf`,
			base64: buffer.toString("base64"),
		};
	}

	async send(input: EstimateSendInput) {
		if (!this.mailer.isConfigured()) {
			throw new BadRequestException("Email is not configured on this install.");
		}

		const estimate = await this.loadForPdf(input.id);
		const to = input.to ?? estimate.contact?.email ?? null;

		if (!to) {
			throw new BadRequestException(
				"This estimate has nobody to send it to yet.",
			);
		}

		const workspaceName = await this.workspaceName();
		const buffer = await renderEstimatePdf(estimate, workspaceName);

		const result = await this.mailer.send({
			to,
			subject: input.subject,
			text: input.message,
			attachments: [
				{
					filename: `${this.filenameStem(estimate.title)}.pdf`,
					content: buffer,
					contentType: "application/pdf",
				},
			],
		});

		if (!result.delivered) {
			throw new BadRequestException(
				"The email could not be sent. Check the mail configuration and try again.",
			);
		}

		try {
			return await this.db.estimate.update({
				where: { id: input.id },
				data: { status: "SENT" },
				select: { id: true, status: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	mailerConfigured(): boolean {
		return this.mailer.isConfigured();
	}

	private async loadForPdf(id: string) {
		const row = await this.db.estimate.findUnique({
			where: { id },
			include: {
				lineItems: { orderBy: { sortOrder: "asc" } },
				contact: { select: PDF_CONTACT_SELECT },
			},
		});

		if (!row) {
			throw new NotFoundException(`No estimate with id ${id}.`);
		}

		return {
			...row,
			lineItems: row.lineItems.map((item) => ({
				name: item.name,
				unit: item.unit,
				quantity: Number(item.quantity),
				areaLabel: item.areaLabel,
				priceGoodCents: item.priceGoodCents,
				priceBetterCents: item.priceBetterCents,
				priceBestCents: item.priceBestCents,
			})),
		};
	}

	private async workspaceName(): Promise<string> {
		const workspace = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { name: true },
		});
		return workspace?.name ?? DEFAULT_WORKSPACE_NAME;
	}

	private filenameStem(title: string): string {
		const stem = title
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, MAX_FILENAME_STEM);
		return stem || "estimate";
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
			...(input.drawingId ? { drawingId: input.drawingId } : {}),
			...(input.status ? { status: input.status } : {}),
		};

		const term = input.q.trim();
		if (term) {
			where.title = { contains: term, mode: "insensitive" };
		}

		return where;
	}

	private translate(error: unknown, id?: string): unknown {
		if (error instanceof NotFoundException) {
			return error;
		}
		if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (error.code === "P2025" && id) {
				return new NotFoundException(`No estimate with id ${id}.`);
			}
			if (error.code === "P2003") {
				return new BadRequestException("That record no longer exists.");
			}
		}
		return error;
	}
}
