import { DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	maskCents,
	maskLineItems,
	moneyRefusalMessage,
} from "@crm/db/access-money";
import { type AccessPrincipal, hasMoney } from "@crm/db/access-policy";
import {
	contactScopeWhere,
	dealChildWhere,
	dealScopeWhere,
	isUnscoped,
} from "@crm/db/access-scope";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { MailerService } from "../mailer/mailer.service";
import { PhotosService } from "../photos/photos.service";
import { ProductionAdvanceService } from "../production/production-advance.service";
import { MergeContextService } from "../templates/merge-context.service";
import {
	assertMergeComplete,
	collectTokens,
	missingMerges,
} from "../templates/merge-guard";
import {
	applyMergeFields,
	renderEmailHtml,
	resolveEmailBrand,
} from "../templates/render-email";
import { parseTemplateBlocks } from "../templates/template-blocks";
import { TemplatesService } from "../templates/templates.service";
import { paginate, resolveOrderBy } from "../trpc/list-input";
import {
	agingBucket,
	lineItemsTotalCents,
	linesFromEstimate,
} from "./invoice-logic";
import { renderInvoicePdf } from "./invoice-pdf";
import { INVOICES } from "./invoices.config";
import type {
	InvoiceAddLineItemInput,
	InvoiceCreateFromEstimateInput,
	InvoiceCreateInput,
	InvoiceListInput,
	InvoiceSendInput,
	InvoiceSetStatusInput,
	InvoiceUpdateInput,
	InvoiceUpdateLineItemInput,
} from "./invoices.contracts";

const PDF_CONTACT_SELECT = {
	firstName: true,
	lastName: true,
	email: true,
	phone: true,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.InvoiceOrderByWithRelationInput[]
> = {
	number: (dir) => [{ number: dir }],
	status: (dir) => [{ status: dir }],
	dueAt: (dir) => [{ dueAt: dir }],
	updatedAt: (dir) => [{ updatedAt: dir }],
};

const LIST_SELECT = {
	id: true,
	number: true,
	status: true,
	currency: true,
	contactId: true,
	dealId: true,
	dueAt: true,
	updatedAt: true,
	contact: { select: { firstName: true, lastName: true } },
	deal: { select: { name: true } },
	lineItems: { select: { quantity: true, priceCents: true } },
} as const;

function contactName(
	contact: { firstName: string; lastName: string | null } | null,
): string | null {
	if (!contact) return null;
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

@Injectable()
export class InvoicesService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly mailer: MailerService,
		private readonly templates: TemplatesService,
		private readonly mergeContext: MergeContextService,
		private readonly photos: PhotosService,
		private readonly production: ProductionAdvanceService,
	) {}

	async list(input: InvoiceListInput, p: AccessPrincipal) {
		const where: Prisma.InvoiceWhereInput = {
			AND: [this.buildWhere(input), dealChildWhere(p)],
		};
		const { skip, take } = paginate(input);
		const now = new Date();

		const [rows, total] = await Promise.all([
			this.db.invoice.findMany({
				where,
				orderBy: resolveOrderBy(input, SORTABLE, [{ updatedAt: "desc" }]),
				skip,
				take,
				select: LIST_SELECT,
			}),
			this.db.invoice.count({ where }),
		]);

		return {
			rows: rows.map(({ contact, deal, lineItems, dueAt, updatedAt, ...row }) =>
				maskCents(
					p,
					"prices",
					{
						...row,
						contactName: contactName(contact),
						dealName: deal?.name ?? null,
						totalCents: lineItemsTotalCents(lineItems),
						aging: agingBucket(dueAt, row.status, now),
						dueAt: dueAt?.toISOString() ?? null,
						updatedAt: updatedAt.toISOString(),
					},
					["totalCents"],
				),
			),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string, p: AccessPrincipal) {
		const row = await this.db.invoice.findFirst({
			where: { AND: [{ id }, dealChildWhere(p)] },
			include: {
				lineItems: { orderBy: { sortOrder: "asc" } },
			},
		});

		if (!row) {
			throw new NotFoundException(`No invoice with id ${id}.`);
		}

		return maskCents(
			p,
			"prices",
			{
				...row,
				lineItems: maskLineItems(p, "prices", row.lineItems, ["priceCents"]),
				totalCents: lineItemsTotalCents(row.lineItems),
				aging: agingBucket(row.dueAt, row.status, new Date()),
				issuedAt: row.issuedAt?.toISOString() ?? null,
				dueAt: row.dueAt?.toISOString() ?? null,
				paidAt: row.paidAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
			},
			["totalCents"],
		);
	}

	async create(input: InvoiceCreateInput, p: AccessPrincipal) {
		if (input.dealId) {
			await this.assertDealInScope(input.dealId, p);
		} else {
			this.assertDeallessCreateAllowed(p);
		}
		if (input.contactId) {
			await this.assertContactInScope(input.contactId, p);
		}
		const currency = await this.currencyFor(input.dealId);

		try {
			return await this.db.invoice.create({
				data: {
					dealId: input.dealId,
					contactId: input.contactId,
					currency,
					createdById: p.userId,
				},
			});
		} catch (error) {
			throw this.translate(error);
		}
	}

	async createFromEstimate(
		input: InvoiceCreateFromEstimateInput,
		p: AccessPrincipal,
	) {
		const estimate = await this.db.estimate.findFirst({
			where: { AND: [{ id: input.estimateId }, dealChildWhere(p)] },
			include: { lineItems: { orderBy: { sortOrder: "asc" } } },
		});

		if (!estimate) {
			throw new NotFoundException(`No estimate with id ${input.estimateId}.`);
		}

		if (estimate.lineItems.length === 0) {
			throw new BadRequestException("This estimate has no line items.");
		}

		const tier = input.tier ?? estimate.selectedTier;
		const lines = linesFromEstimate(estimate, tier);
		const dueAt = new Date(Date.now() + INVOICES.defaultNetDays * DAY_MS);

		return this.db.$transaction(async (tx) => {
			const invoice = await tx.invoice.create({
				data: {
					status: "DRAFT",
					currency: estimate.currency,
					dealId: estimate.dealId,
					contactId: estimate.contactId,
					estimateId: estimate.id,
					dueAt,
					createdById: p.userId,
				},
			});

			await tx.invoiceLineItem.createMany({
				data: lines.map((line) => ({
					invoiceId: invoice.id,
					...line,
				})),
			});

			return { id: invoice.id };
		});
	}

	async setStatus(
		input: InvoiceSetStatusInput,
		actingUserId: string,
		p: AccessPrincipal,
	) {
		await this.assertInScope(input.id, p);
		const invoice = await this.db.invoice.findUnique({
			where: { id: input.id },
			select: { issuedAt: true },
		});
		if (!invoice) {
			throw new NotFoundException(`No invoice with id ${input.id}.`);
		}

		const issuedAt =
			input.status === "SENT" && !invoice.issuedAt ? new Date() : undefined;

		let updated: {
			id: string;
			status: string;
			issuedAt: Date | null;
			dealId: string | null;
		};
		try {
			updated = await this.db.invoice.update({
				where: { id: input.id },
				data: { status: input.status, ...(issuedAt ? { issuedAt } : {}) },
				select: { id: true, status: true, issuedAt: true, dealId: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
		if (input.status === "PAID" && updated.dealId) {
			await this.production.advanceWhenPaid(updated.dealId, actingUserId);
		}
		const { dealId: _dealId, ...result } = updated;
		return result;
	}

	async markPaid(id: string, actingUserId: string, p: AccessPrincipal) {
		await this.assertInScope(id, p);
		let updated: {
			id: string;
			status: string;
			paidAt: Date | null;
			dealId: string | null;
		};
		try {
			updated = await this.db.invoice.update({
				where: { id },
				data: { status: "PAID", paidAt: new Date() },
				select: { id: true, status: true, paidAt: true, dealId: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
		if (updated.dealId) {
			await this.production.advanceWhenPaid(updated.dealId, actingUserId);
		}
		const { dealId: _dealId, ...result } = updated;
		return result;
	}

	async update(input: InvoiceUpdateInput, p: AccessPrincipal) {
		await this.assertInScope(input.id, p);
		if (typeof input.data.contactId === "string") {
			await this.assertContactInScope(input.data.contactId, p);
		}
		let updated: {
			id: string;
			notes: string | null;
			dueAt: Date | null;
			issuedAt: Date | null;
			contactId: string | null;
		};
		try {
			updated = await this.db.invoice.update({
				where: { id: input.id },
				data: input.data,
				select: {
					id: true,
					notes: true,
					dueAt: true,
					issuedAt: true,
					contactId: true,
				},
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
		if (typeof input.data.contactId === "string") {
			await this.photos.reanchorForInvoice(input.id, {
				contactId: input.data.contactId,
			});
		}
		return updated;
	}

	async delete(id: string, p: AccessPrincipal) {
		await this.assertInScope(id, p);
		try {
			return await this.db.invoice.delete({
				where: { id },
				select: { id: true, number: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async addLineItem(input: InvoiceAddLineItemInput, p: AccessPrincipal) {
		await this.assertInScope(input.invoiceId, p);
		const line = input.serviceId
			? await this.serviceLine(input.serviceId)
			: {
					name: input.name,
					unit: input.unit,
					priceCents: input.priceCents,
				};
		if (!input.serviceId) {
			this.assertCanWritePrices(p, [
				input.priceCents === 0 ? undefined : input.priceCents,
			]);
		}

		const count = await this.db.invoiceLineItem.count({
			where: { invoiceId: input.invoiceId },
		});

		const created = await this.db.invoiceLineItem.create({
			data: {
				invoiceId: input.invoiceId,
				name: line.name,
				unit: line.unit,
				quantity: input.quantity,
				priceCents: line.priceCents,
				areaLabel: input.areaLabel,
				sortOrder: count,
			},
		});
		return maskCents(p, "prices", created, ["priceCents"]);
	}

	private async serviceLine(serviceId: string) {
		const service = await this.db.service.findUnique({
			where: { id: serviceId },
			select: { name: true, unit: true, unitPriceCents: true },
		});
		if (!service) {
			throw new NotFoundException(`No service with id ${serviceId}.`);
		}
		return {
			name: service.name,
			unit: service.unit,
			priceCents: service.unitPriceCents,
		};
	}

	async updateLineItem(input: InvoiceUpdateLineItemInput, p: AccessPrincipal) {
		await this.assertLineItemInScope(input.id, p);
		this.assertCanWritePrices(p, [input.data.priceCents]);
		try {
			const updated = await this.db.invoiceLineItem.update({
				where: { id: input.id },
				data: input.data,
			});
			return maskCents(p, "prices", updated, ["priceCents"]);
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async removeLineItem(id: string, p: AccessPrincipal) {
		await this.assertLineItemInScope(id, p);
		try {
			return await this.db.invoiceLineItem.delete({
				where: { id },
				select: { id: true, name: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async document(
		id: string,
		p: AccessPrincipal,
	): Promise<{ filename: string; base64: string }> {
		await this.assertInScope(id, p);
		this.assertCanExportPriced(p);
		const invoice = await this.loadForPdf(id);
		const workspaceName = await this.workspaceName();
		const buffer = await renderInvoicePdf(invoice, workspaceName);

		return {
			filename: `invoice-${invoice.number}.pdf`,
			base64: buffer.toString("base64"),
		};
	}

	async send(
		input: InvoiceSendInput,
		senderName: string | undefined,
		p: AccessPrincipal,
	) {
		await this.assertInScope(input.id, p);
		this.assertCanExportPriced(p);

		if (!this.mailer.isConfigured()) {
			throw new BadRequestException("Email is not configured on this install.");
		}

		const invoice = await this.loadForPdf(input.id);
		const to = input.to ?? invoice.contact?.email ?? null;

		if (!to) {
			throw new BadRequestException(
				"This invoice has nobody to send it to yet.",
			);
		}

		const workspaceName = await this.workspaceName();
		const buffer = await renderInvoicePdf(invoice, workspaceName);

		const context = await this.mergeContext.resolve({
			contactId: invoice.contactId ?? undefined,
			dealId: invoice.dealId ?? undefined,
			invoiceId: invoice.id,
			senderName,
			personalNote: input.personalNote,
		});

		const template = await this.templates.byPurpose({
			purpose: "INVOICE_SEND",
		});
		const blocks = parseTemplateBlocks(template.blocks);

		const registry = await this.templates.mergeRegistry();
		const tokens = collectTokens(template.subject ?? "", blocks);
		assertMergeComplete("invoice", missingMerges(tokens, context, registry));

		const subject =
			input.subject ??
			(template.subject
				? applyMergeFields(template.subject, context)
				: `Your invoice from ${workspaceName}`);

		const brand = await resolveEmailBrand(this.db);
		const { html, text } = renderEmailHtml(blocks, context, "email", brand);

		const result = await this.mailer.send({
			to,
			subject,
			text,
			html,
			attachments: [
				{
					filename: `invoice-${invoice.number}.pdf`,
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
			return await this.db.invoice.update({
				where: { id: input.id },
				data: {
					status: "SENT",
					issuedAt: invoice.issuedAt ?? new Date(),
				},
				select: { id: true, status: true, issuedAt: true },
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	private async assertInScope(id: string, p: AccessPrincipal): Promise<void> {
		const found = await this.db.invoice.findFirst({
			where: { AND: [{ id }, dealChildWhere(p)] },
			select: { id: true },
		});
		if (!found) throw new NotFoundException(`No invoice with id ${id}.`);
	}

	private assertCanExportPriced(p: AccessPrincipal): void {
		if (hasMoney(p, "prices")) return;
		throw new ForbiddenException(
			moneyRefusalMessage(p, "see prices, so it can't export a priced PDF."),
		);
	}

	private assertCanWritePrices(
		p: AccessPrincipal,
		priceFields: readonly (number | undefined)[],
	): void {
		if (hasMoney(p, "prices")) return;
		if (priceFields.some((value) => value !== undefined)) {
			throw new ForbiddenException(moneyRefusalMessage(p, "set prices."));
		}
	}

	private async assertLineItemInScope(
		id: string,
		p: AccessPrincipal,
	): Promise<void> {
		const found = await this.db.invoiceLineItem.findFirst({
			where: { AND: [{ id }, { invoice: dealChildWhere(p) }] },
			select: { id: true },
		});
		if (!found) throw new NotFoundException(`No line item with id ${id}.`);
	}

	private async assertDealInScope(
		dealId: string,
		p: AccessPrincipal,
	): Promise<void> {
		const found = await this.db.deal.findFirst({
			where: { AND: [{ id: dealId }, dealScopeWhere(p)] },
			select: { id: true },
		});
		if (!found) throw new NotFoundException(`No deal with id ${dealId}.`);
	}

	private async assertContactInScope(
		contactId: string,
		p: AccessPrincipal,
	): Promise<void> {
		const found = await this.db.contact.findFirst({
			where: { AND: [{ id: contactId }, contactScopeWhere(p)] },
			select: { id: true },
		});
		if (!found) {
			throw new NotFoundException(`No contact with id ${contactId}.`);
		}
	}

	private assertDeallessCreateAllowed(p: AccessPrincipal): void {
		if (isUnscoped(p) || p.scope !== "ASSIGNED") return;
		throw new ForbiddenException(
			`Your group (${p.groupName}) can only create these on a job assigned to you. Ask an admin.`,
		);
	}

	private async loadForPdf(id: string) {
		const row = await this.db.invoice.findUnique({
			where: { id },
			include: {
				lineItems: { orderBy: { sortOrder: "asc" } },
				contact: { select: PDF_CONTACT_SELECT },
			},
		});

		if (!row) {
			throw new NotFoundException(`No invoice with id ${id}.`);
		}

		const photos = await this.photos.pdfPhotosForInvoice(id);

		return {
			...row,
			lineItems: row.lineItems.map((item) => ({
				name: item.name,
				unit: item.unit,
				quantity: Number(item.quantity),
				areaLabel: item.areaLabel,
				priceCents: item.priceCents,
			})),
			photos,
		};
	}

	private async workspaceName(): Promise<string> {
		const workspace = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { name: true },
		});
		return workspace?.name ?? DEFAULT_WORKSPACE_NAME;
	}

	private async currencyFor(dealId: string | undefined): Promise<string> {
		if (!dealId) return "USD";
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: { currency: true },
		});
		return deal?.currency ?? "USD";
	}

	private buildWhere(input: InvoiceListInput): Prisma.InvoiceWhereInput {
		const where: Prisma.InvoiceWhereInput = {
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.contactId ? { contactId: input.contactId } : {}),
			...(input.estimateId ? { estimateId: input.estimateId } : {}),
			...(input.status ? { status: input.status } : {}),
		};

		const term = input.q.trim();
		if (term) {
			const asNumber = Number(term);
			if (Number.isInteger(asNumber)) {
				where.number = asNumber;
			}
		}

		return where;
	}

	private translate(error: unknown, id?: string): unknown {
		if (error instanceof NotFoundException) {
			return error;
		}
		if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (error.code === "P2025" && id) {
				return new NotFoundException(`No invoice with id ${id}.`);
			}
			if (error.code === "P2003") {
				return new BadRequestException("That record no longer exists.");
			}
		}
		return error;
	}
}
