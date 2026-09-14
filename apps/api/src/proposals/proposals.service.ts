import { randomBytes } from "node:crypto";
import { appUrl, DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
import type { Db, EstimateTier, Prisma } from "@crm/db";
import { ActivityType } from "@crm/db/enums";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { ContractsService } from "../contracts/contracts.service";
import { InjectDatabase } from "../database/database.constants";
import { tierTotals } from "../estimates/estimate-pdf";
import { MailerService } from "../mailer/mailer.service";
import { PhotosService } from "../photos/photos.service";
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
import { renderProposalPdf } from "./proposal-pdf";
import { PROPOSALS } from "./proposals.config";
import type {
	ProposalAcceptInput,
	ProposalSendInput,
	ProposalUpdateInput,
} from "./proposals.contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

const DETAIL_SELECT = {
	id: true,
	number: true,
	title: true,
	status: true,
	coverTitle: true,
	coverSubtitle: true,
	body: true,
	estimateId: true,
	createdAt: true,
	updatedAt: true,
	sentAt: true,
	sentTo: true,
	viewToken: true,
	tokenExpiresAt: true,
	acceptedAt: true,
	acceptedTier: true,
	acceptedName: true,
	estimate: {
		select: {
			id: true,
			title: true,
			currency: true,
			selectedTier: true,
			dealId: true,
			contactId: true,
			contact: {
				select: { id: true, firstName: true, lastName: true, email: true },
			},
		},
	},
} as const satisfies Prisma.ProposalSelect;

const PRICING_SELECT = {
	name: true,
	unit: true,
	quantity: true,
	areaLabel: true,
	priceGoodCents: true,
	priceBetterCents: true,
	priceBestCents: true,
} as const;

function contactName(contact: {
	firstName: string;
	lastName: string | null;
}): string {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

@Injectable()
export class ProposalsService {
	private readonly logger = new Logger(ProposalsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly templates: TemplatesService,
		private readonly mergeContext: MergeContextService,
		private readonly mailer: MailerService,
		private readonly contracts: ContractsService,
		private readonly photos: PhotosService,
	) {}

	async forEstimate(estimateId: string) {
		const row = await this.db.proposal.findUnique({
			where: { estimateId },
			select: DETAIL_SELECT,
		});
		if (!row) return null;
		return this.detail(row);
	}

	async createFromEstimate(estimateId: string, userId: string) {
		const estimate = await this.db.estimate.findUnique({
			where: { id: estimateId },
			select: { id: true, title: true },
		});
		if (!estimate) {
			throw new NotFoundException(`No estimate with id ${estimateId}.`);
		}

		const existing = await this.db.proposal.findUnique({
			where: { estimateId },
			select: DETAIL_SELECT,
		});
		if (existing) return this.detail(existing);

		const template = await this.templates.byPurpose({
			purpose: "PROPOSAL_BODY",
		});
		const body = parseTemplateBlocks(template.blocks);

		const row = await this.db.proposal.create({
			data: {
				title: estimate.title,
				estimateId,
				body,
				createdById: userId,
			},
			select: DETAIL_SELECT,
		});
		return this.detail(row);
	}

	async update(input: ProposalUpdateInput) {
		const existing = await this.loadOrThrow(input.id);
		if (existing.status !== "DRAFT" && existing.status !== "SENT") {
			throw new ConflictException("This proposal can no longer be edited.");
		}
		if (input.data.body !== undefined && existing.status !== "DRAFT") {
			throw new ConflictException(
				"A sent proposal's content is locked. Void it to edit again.",
			);
		}

		try {
			const row = await this.db.proposal.update({
				where: { id: input.id },
				data: input.data,
				select: DETAIL_SELECT,
			});
			return this.detail(row);
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async send(input: ProposalSendInput, senderName?: string) {
		if (!this.mailer.isConfigured()) {
			throw new BadRequestException("Email is not configured on this install.");
		}

		const proposal = await this.db.proposal.findUnique({
			where: { id: input.id },
			select: DETAIL_SELECT,
		});
		if (!proposal) {
			throw new NotFoundException(`No proposal with id ${input.id}.`);
		}
		if (proposal.status === "ACCEPTED" || proposal.status === "VOID") {
			throw new ConflictException("This proposal can no longer be sent.");
		}

		const to = input.to ?? proposal.estimate.contact?.email ?? null;
		if (!to) {
			throw new BadRequestException(
				"This proposal has nobody to send it to yet.",
			);
		}

		const token = randomBytes(PROPOSALS.viewToken.bytes).toString("base64url");
		const proposalLink = `${appUrl}/proposal/${token}`;

		const context = await this.mergeContext.resolve({
			contactId: proposal.estimate.contactId ?? undefined,
			dealId: proposal.estimate.dealId ?? undefined,
			estimateId: proposal.estimateId,
			senderName,
			proposalLink,
			personalNote: input.personalNote,
		});

		const template = await this.templates.byPurpose({
			purpose: "PROPOSAL_SEND",
		});
		const blocks = parseTemplateBlocks(template.blocks);

		const registry = await this.templates.mergeRegistry();
		const tokens = collectTokens(template.subject ?? "", blocks);
		assertMergeComplete("proposal", missingMerges(tokens, context, registry));

		const subject =
			input.subject ??
			(template.subject
				? applyMergeFields(template.subject, context)
				: `Your proposal from ${context["business.name"] ?? ""}`.trim());

		const brand = await resolveEmailBrand(this.db);
		const { html, text } = renderEmailHtml(blocks, context, "email", brand);

		const result = await this.mailer.send({ to, subject, text, html });
		if (!result.delivered) {
			throw new BadRequestException(
				"The email could not be sent. Check the mail configuration and try again.",
			);
		}

		const tokenExpiresAt = new Date(
			Date.now() + PROPOSALS.viewToken.expiryDays * DAY_MS,
		);

		try {
			const row = await this.db.proposal.update({
				where: { id: input.id },
				data: {
					status: "SENT",
					sentAt: new Date(),
					sentTo: to,
					viewToken: token,
					tokenExpiresAt,
				},
				select: DETAIL_SELECT,
			});
			return this.detail(row);
		} catch (error) {
			throw this.translate(error, input.id);
		}
	}

	async void(id: string) {
		const existing = await this.loadOrThrow(id);
		if (existing.status !== "DRAFT" && existing.status !== "SENT") {
			throw new ConflictException("This proposal can no longer be voided.");
		}
		try {
			const row = await this.db.proposal.update({
				where: { id },
				data: { status: "VOID", viewToken: null, tokenExpiresAt: null },
				select: DETAIL_SELECT,
			});
			return this.detail(row);
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async document(id: string): Promise<{ filename: string; base64: string }> {
		const proposal = await this.db.proposal.findUnique({
			where: { id },
			select: DETAIL_SELECT,
		});
		if (!proposal) {
			throw new NotFoundException(`No proposal with id ${id}.`);
		}

		const lineItems = await this.pricingLineItems(proposal.estimateId);
		const context = await this.mergeContext.resolve({
			contactId: proposal.estimate.contactId ?? undefined,
			dealId: proposal.estimate.dealId ?? undefined,
			estimateId: proposal.estimateId,
		});
		const photos = await this.photos.pdfPhotosForEstimate(proposal.estimateId);
		const workspaceName = await this.workspaceName();

		const buffer = await renderProposalPdf(
			{
				number: proposal.number,
				title: proposal.title,
				coverTitle: proposal.coverTitle,
				coverSubtitle: proposal.coverSubtitle,
				contactName: proposal.estimate.contact
					? contactName(proposal.estimate.contact)
					: null,
				currency: proposal.estimate.currency,
				selectedTier: proposal.estimate.selectedTier,
				acceptedTier: proposal.acceptedTier,
				lineItems,
				body: parseTemplateBlocks(proposal.body),
				context,
				photos,
				createdAt: proposal.createdAt,
			},
			workspaceName,
		);

		return {
			filename: `proposal-${proposal.number}.pdf`,
			base64: buffer.toString("base64"),
		};
	}

	async byToken(token: string) {
		const proposal = await this.db.proposal.findUnique({
			where: { viewToken: token },
			select: DETAIL_SELECT,
		});
		if (!proposal || proposal.status === "DRAFT") {
			throw new NotFoundException("This proposal link is not valid.");
		}

		const context = await this.mergeContext.resolve({
			contactId: proposal.estimate.contactId ?? undefined,
			dealId: proposal.estimate.dealId ?? undefined,
			estimateId: proposal.estimateId,
		});

		const brand = await resolveEmailBrand(this.db);
		let bodyHtml: string;
		try {
			({ html: bodyHtml } = renderEmailHtml(
				parseTemplateBlocks(proposal.body),
				context,
				"document",
				brand,
			));
		} catch {
			throw new ConflictException("This proposal can no longer be viewed.");
		}

		const lineItems = await this.pricingLineItems(proposal.estimateId);
		const totals = tierTotals(lineItems);
		const photoLinks = await this.db.estimatePhoto.findMany({
			where: { estimateId: proposal.estimateId, includeInPdf: true },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: { photoId: true },
		});

		return {
			number: proposal.number,
			title: proposal.title,
			coverTitle: proposal.coverTitle,
			coverSubtitle: proposal.coverSubtitle,
			businessName: context["business.name"] ?? DEFAULT_WORKSPACE_NAME,
			contactName: proposal.estimate.contact
				? contactName(proposal.estimate.contact)
				: "",
			bodyHtml,
			status: proposal.status,
			currency: proposal.estimate.currency,
			defaultTier: proposal.estimate.selectedTier,
			totals,
			lineItems: lineItems.map((item) => ({
				name: item.name,
				quantity: item.quantity,
				areaLabel: item.areaLabel,
			})),
			photoIds: photoLinks.map((link) => link.photoId),
			acceptedAt: proposal.acceptedAt,
			acceptedTier: proposal.acceptedTier,
			acceptedName: proposal.acceptedName,
			expired:
				proposal.tokenExpiresAt !== null &&
				proposal.tokenExpiresAt < new Date(),
		};
	}

	async accept(input: ProposalAcceptInput) {
		const proposal = await this.db.proposal.findUnique({
			where: { viewToken: input.token },
			select: {
				id: true,
				status: true,
				tokenExpiresAt: true,
				estimateId: true,
				createdById: true,
				estimate: { select: { dealId: true } },
			},
		});
		if (!proposal || proposal.status === "DRAFT") {
			throw new NotFoundException("This proposal link is not valid.");
		}
		if (proposal.status === "ACCEPTED") {
			throw new ConflictException("This proposal has already been accepted.");
		}
		if (proposal.status === "VOID") {
			throw new ConflictException("This proposal is no longer available.");
		}
		if (!proposal.tokenExpiresAt || proposal.tokenExpiresAt < new Date()) {
			throw new ConflictException("This proposal link has expired.");
		}

		const acceptedAt = new Date();

		let result: { count: number };
		try {
			result = await this.db.proposal.updateMany({
				where: { id: proposal.id, status: "SENT" },
				data: {
					status: "ACCEPTED",
					acceptedAt,
					acceptedTier: input.tier,
					acceptedName: input.name,
				},
			});
		} catch (error) {
			throw this.translate(error, proposal.id);
		}
		if (result.count === 0) {
			throw new ConflictException("This proposal has already been accepted.");
		}

		await this.afterAccept(proposal, input.tier, input.name, acceptedAt);

		return { status: "ACCEPTED" as const, acceptedAt, tier: input.tier };
	}

	private async afterAccept(
		proposal: {
			id: string;
			estimateId: string;
			createdById: string;
			estimate: { dealId: string | null };
		},
		tier: EstimateTier,
		name: string,
		acceptedAt: Date,
	): Promise<void> {
		try {
			await this.db.estimate.update({
				where: { id: proposal.estimateId },
				data: { status: "ACCEPTED", selectedTier: tier },
				select: { id: true },
			});
		} catch (error) {
			this.logger.error(
				{
					message: "Accepted proposal could not update the estimate",
					proposalId: proposal.id,
				},
				error instanceof Error ? error.stack : undefined,
			);
		}

		try {
			await this.contracts.createFromEstimate(
				{ estimateId: proposal.estimateId },
				proposal.createdById,
			);
		} catch (error) {
			this.logger.error(
				{
					message: "Accepted proposal could not create a draft contract",
					proposalId: proposal.id,
				},
				error instanceof Error ? error.stack : undefined,
			);
		}

		if (proposal.estimate.dealId) {
			try {
				await this.db.activity.create({
					data: {
						type: ActivityType.NOTE,
						subject: "Proposal accepted",
						occurredAt: acceptedAt,
						dealId: proposal.estimate.dealId,
						createdById: proposal.createdById,
						meta: { kind: "proposal", tier, acceptedName: name },
					},
				});
			} catch (error) {
				this.logger.error(
					{
						message: "Accepted proposal could not log an activity",
						proposalId: proposal.id,
					},
					error instanceof Error ? error.stack : undefined,
				);
			}
		}
	}

	async photoForToken(token: string, photoId: string) {
		const proposal = await this.db.proposal.findUnique({
			where: { viewToken: token },
			select: { status: true, tokenExpiresAt: true, estimateId: true },
		});
		if (
			!proposal ||
			proposal.status === "DRAFT" ||
			proposal.status === "VOID"
		) {
			return null;
		}
		if (!proposal.tokenExpiresAt || proposal.tokenExpiresAt < new Date()) {
			return null;
		}
		const link = await this.db.estimatePhoto.findUnique({
			where: {
				estimateId_photoId: { estimateId: proposal.estimateId, photoId },
			},
			select: { id: true },
		});
		return link ? { photoId } : null;
	}

	mailerConfigured(): boolean {
		return this.mailer.isConfigured();
	}

	private async pricingLineItems(estimateId: string) {
		const rows = await this.db.estimateLineItem.findMany({
			where: { estimateId },
			orderBy: { sortOrder: "asc" },
			select: PRICING_SELECT,
		});
		return rows.map((row) => ({
			name: row.name,
			unit: row.unit,
			quantity: Number(row.quantity),
			areaLabel: row.areaLabel,
			priceGoodCents: row.priceGoodCents,
			priceBetterCents: row.priceBetterCents,
			priceBestCents: row.priceBestCents,
		}));
	}

	private detail<T extends { body: Prisma.JsonValue }>(row: T) {
		return { ...row, body: parseTemplateBlocks(row.body) };
	}

	private async loadOrThrow(id: string) {
		const row = await this.db.proposal.findUnique({
			where: { id },
			select: { id: true, status: true },
		});
		if (!row) {
			throw new NotFoundException(`No proposal with id ${id}.`);
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

	private translate(error: unknown, id: string): Error {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code: string }).code === "P2025"
		) {
			return new NotFoundException(`No proposal with id ${id}.`);
		}
		return error instanceof Error ? error : new Error(String(error));
	}
}
