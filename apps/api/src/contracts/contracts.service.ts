import { randomBytes } from "node:crypto";
import { appUrl, DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { MailerService } from "../mailer/mailer.service";
import { MergeContextService } from "../templates/merge-context.service";
import { applyMergeFields, renderEmailHtml } from "../templates/render-email";
import { parseTemplateBlocks } from "../templates/template-blocks";
import { TemplatesService } from "../templates/templates.service";
import { paginate, resolveOrderBy } from "../trpc/list-input";
import { renderContractPdf } from "./contract-pdf";
import { CONTRACTS } from "./contracts.config";
import type {
	ContractCreateFromEstimateInput,
	ContractCreateInput,
	ContractListInput,
	ContractSendInput,
	ContractUpdateInput,
} from "./contracts.contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

const LIST_SELECT = {
	id: true,
	number: true,
	title: true,
	status: true,
	dealId: true,
	contactId: true,
	sentAt: true,
	signedAt: true,
	updatedAt: true,
	estimate: { select: { id: true, title: true } },
	invoice: { select: { id: true, number: true } },
	contact: { select: { id: true, firstName: true, lastName: true } },
} as const;

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.ContractOrderByWithRelationInput[]
> = {
	title: (dir) => [{ title: dir }],
	status: (dir) => [{ status: dir }],
	number: (dir) => [{ number: dir }],
	updatedAt: (dir) => [{ updatedAt: dir }],
};

function contactName(contact: {
	firstName: string;
	lastName: string | null;
}): string {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

@Injectable()
export class ContractsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly templates: TemplatesService,
		private readonly mergeContext: MergeContextService,
		private readonly mailer: MailerService,
	) {}

	async list(input: ContractListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total] = await Promise.all([
			this.db.contract.findMany({
				where,
				orderBy: resolveOrderBy(input, SORTABLE, [{ updatedAt: "desc" }]),
				skip,
				take,
				select: LIST_SELECT,
			}),
			this.db.contract.count({ where }),
		]);

		return {
			rows: rows.map(({ contact, ...row }) => ({
				...row,
				contact: contact
					? { id: contact.id, name: contactName(contact) }
					: null,
			})),
			total,
			facetCounts: {},
		};
	}

	async byId(id: string) {
		const row = await this.loadOrThrow(id);
		return { ...row, body: parseTemplateBlocks(row.body) };
	}

	async createFromEstimate(
		input: ContractCreateFromEstimateInput,
		userId: string,
	) {
		const estimate = await this.db.estimate.findUnique({
			where: { id: input.estimateId },
			select: { title: true, dealId: true, contactId: true },
		});

		if (!estimate) {
			throw new NotFoundException(`No estimate with id ${input.estimateId}.`);
		}

		const body = await this.contractBodySnapshot();

		return this.db.contract.create({
			data: {
				title: estimate.title,
				dealId: estimate.dealId,
				contactId: estimate.contactId,
				estimateId: input.estimateId,
				body,
				createdById: userId,
			},
		});
	}

	async create(input: ContractCreateInput, userId: string) {
		const body = await this.contractBodySnapshot();

		return this.db.contract.create({
			data: {
				title: input.title ?? "Untitled contract",
				dealId: input.dealId,
				contactId: input.contactId,
				body,
				createdById: userId,
			},
		});
	}

	async update(input: ContractUpdateInput) {
		const existing = await this.loadOrThrow(input.id);

		if (existing.status !== "DRAFT") {
			const keys = Object.keys(input.data);
			const onlyInvoiceLink =
				keys.length > 0 && keys.every((key) => key === "invoiceId");

			if (!(existing.status === "SENT" && onlyInvoiceLink)) {
				throw new ConflictException("This contract can no longer be edited.");
			}
		}

		try {
			return await this.db.contract.update({
				where: { id: input.id },
				data: {
					...(input.data.title !== undefined
						? { title: input.data.title }
						: {}),
					...(input.data.body !== undefined ? { body: input.data.body } : {}),
					...(input.data.invoiceId !== undefined
						? { invoiceId: input.data.invoiceId }
						: {}),
					...(input.data.contactId !== undefined
						? { contactId: input.data.contactId }
						: {}),
				},
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async send(input: ContractSendInput) {
		if (!this.mailer.isConfigured()) {
			throw new BadRequestException("Email is not configured on this install.");
		}

		const contract = await this.db.contract.findUnique({
			where: { id: input.id },
			include: { contact: { select: { email: true } } },
		});

		if (!contract) {
			throw new NotFoundException(`No contract with id ${input.id}.`);
		}

		if (contract.status === "SIGNED" || contract.status === "VOID") {
			throw new ConflictException("This contract can no longer be sent.");
		}

		const to = input.to ?? contract.contact?.email ?? null;
		if (!to) {
			throw new BadRequestException(
				"This contract has nobody to send it to yet.",
			);
		}

		const token = randomBytes(CONTRACTS.signingToken.bytes).toString(
			"base64url",
		);
		const signingLink = `${appUrl}/sign/${token}`;

		const context = await this.mergeContext.resolve({
			contactId: contract.contactId ?? undefined,
			dealId: contract.dealId ?? undefined,
			estimateId: contract.estimateId ?? undefined,
			invoiceId: contract.invoiceId ?? undefined,
			contractId: contract.id,
			signingLink,
			personalNote: input.personalNote,
		});

		const template = await this.templates.byPurpose({
			purpose: "CONTRACT_SEND",
		});
		const blocks = parseTemplateBlocks(template.blocks);

		const subject =
			input.subject ??
			(template.subject
				? applyMergeFields(template.subject, context)
				: `Please sign: ${contract.title}`);

		const { html, text } = renderEmailHtml(blocks, context);

		const result = await this.mailer.send({ to, subject, text, html });

		if (!result.delivered) {
			throw new BadRequestException(
				"The email could not be sent. Check the mail configuration and try again.",
			);
		}

		const tokenExpiresAt = new Date(
			Date.now() + CONTRACTS.signingToken.expiryDays * DAY_MS,
		);

		try {
			return await this.db.contract.update({
				where: { id: input.id },
				data: {
					status: "SENT",
					sentAt: new Date(),
					sentTo: to,
					signingToken: token,
					tokenExpiresAt,
				},
			});
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async void(id: string) {
		const existing = await this.loadOrThrow(id);

		if (existing.status !== "DRAFT" && existing.status !== "SENT") {
			throw new ConflictException("This contract can no longer be voided.");
		}

		try {
			return await this.db.contract.update({
				where: { id },
				data: { status: "VOID" },
				select: { id: true, status: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async delete(id: string) {
		const existing = await this.loadOrThrow(id);

		if (existing.status !== "DRAFT") {
			throw new ConflictException("Only a draft contract can be deleted.");
		}

		try {
			return await this.db.contract.delete({
				where: { id },
				select: { id: true, title: true },
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async document(id: string): Promise<{ filename: string; base64: string }> {
		const contract = await this.loadOrThrow(id);
		const workspaceName = await this.workspaceName();

		const context = await this.mergeContext.resolve({
			contactId: contract.contactId ?? undefined,
			dealId: contract.dealId ?? undefined,
			estimateId: contract.estimateId ?? undefined,
			invoiceId: contract.invoiceId ?? undefined,
			contractId: contract.id,
		});

		const buffer = await renderContractPdf(
			{
				title: contract.title,
				number: contract.number,
				bodyHtmlBlocks: parseTemplateBlocks(contract.body),
				context,
				signature:
					contract.signedAt &&
					contract.signerName &&
					contract.signatureKind &&
					contract.signatureData
						? {
								kind: contract.signatureKind as "typed" | "drawn",
								data: contract.signatureData,
								signerName: contract.signerName,
								signedAt: contract.signedAt,
							}
						: undefined,
			},
			workspaceName,
		);

		return {
			filename: `${this.filenameStem(contract.title)}.pdf`,
			base64: buffer.toString("base64"),
		};
	}

	mailerConfigured(): boolean {
		return this.mailer.isConfigured();
	}

	private async contractBodySnapshot() {
		const template = await this.templates.byPurpose({
			purpose: "CONTRACT_BODY",
		});
		return parseTemplateBlocks(template.blocks);
	}

	private async loadOrThrow(id: string) {
		const row = await this.db.contract.findUnique({ where: { id } });

		if (!row) {
			throw new NotFoundException(`No contract with id ${id}.`);
		}

		return row;
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
			.replace(/^-+|-+$/g, "");
		return stem || "contract";
	}

	private buildWhere(input: ContractListInput): Prisma.ContractWhereInput {
		const where: Prisma.ContractWhereInput = {
			...(input.dealId ? { dealId: input.dealId } : {}),
			...(input.contactId ? { contactId: input.contactId } : {}),
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
				return new NotFoundException(`No contract with id ${id}.`);
			}
			if (error.code === "P2003") {
				return new BadRequestException("That record no longer exists.");
			}
		}
		return error;
	}
}
