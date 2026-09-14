import { DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	buildJurisdictionMatchKey,
	canTransition,
	guessJurisdictionFromAddress,
	parsePlaybookFacts,
	parseWorksheetAnswers,
	parseWorksheetTemplate,
	type WorksheetAnswers,
	type WorksheetField,
} from "@crm/db/permits";
import { readPermitSettings } from "@crm/db/settings";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { resolveEmailBrand } from "../templates/render-email";
import { savePermitDocumentFile } from "./permit-files";
import { PERMIT_TYPE_LABEL, renderPermitWorksheetPdf } from "./permit-pdf";
import { PermitPrefillService } from "./permit-prefill.service";
import { PERMITS } from "./permits.config";
import type {
	ApprovePermitAnswerInput,
	AttachChecklistDocumentInput,
	ClearPermitAnswerInput,
	CreatePermitInput,
	InspectionIdInput,
	LockerRenameInput,
	PermitDealIdInput,
	PermitIdInput,
	PermitListInput,
	ResolveJurisdictionInput,
	SetInspectionInput,
	SetPermitAnswerInput,
	SetPermitStatusInput,
	UpdatePermitInput,
} from "./permits.contracts";
import { PlaybooksService } from "./playbooks.service";

function isNotFound(error: unknown): boolean {
	return (
		error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
		error.code === "P2025"
	);
}

@Injectable()
export class PermitsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly playbooks: PlaybooksService,
		private readonly prefill: PermitPrefillService,
	) {}

	async resolveJurisdiction(input: ResolveJurisdictionInput) {
		const matchKey = buildJurisdictionMatchKey(
			input.state,
			input.kind,
			input.name,
		);

		const existing = await this.db.jurisdiction.findUnique({
			where: { matchKey },
		});
		if (existing) return existing;

		try {
			return await this.db.jurisdiction.create({
				data: {
					name: input.name,
					kind: input.kind,
					state: input.state,
					matchKey,
				},
			});
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				return this.db.jurisdiction.findUniqueOrThrow({ where: { matchKey } });
			}
			throw error;
		}
	}

	async jurisdictions() {
		const rows = await this.db.jurisdiction.findMany({
			orderBy: { name: "asc" },
			take: PERMITS.list.pageSize,
			select: {
				id: true,
				name: true,
				kind: true,
				state: true,
				matchKey: true,
				createdAt: true,
				_count: { select: { playbooks: true } },
			},
		});

		return rows.map(({ _count, ...row }) => ({
			...row,
			playbookCount: _count.playbooks,
		}));
	}

	async listByDeal(input: PermitDealIdInput) {
		return this.db.permit.findMany({
			where: { dealId: input.dealId },
			orderBy: { createdAt: "desc" },
			include: { jurisdiction: true },
		});
	}

	async list(input: PermitListInput) {
		const where: Prisma.PermitWhereInput = {
			...(input.status ? { status: input.status } : {}),
			...(input.jurisdictionId ? { jurisdictionId: input.jurisdictionId } : {}),
		};
		const skip = (input.page - 1) * PERMITS.list.pageSize;

		const [rows, total] = await Promise.all([
			this.db.permit.findMany({
				where,
				skip,
				take: PERMITS.list.pageSize,
				orderBy: { createdAt: "desc" },
				include: {
					jurisdiction: true,
					deal: { select: { id: true, name: true, number: true } },
				},
			}),
			this.db.permit.count({ where }),
		]);

		return { rows, total };
	}

	async byId(permitId: string) {
		const permit = await this.db.permit.findUnique({
			where: { id: permitId },
			include: {
				jurisdiction: true,
				documents: { orderBy: { sortOrder: "asc" } },
				inspections: { orderBy: { sortOrder: "asc" } },
				playbook: true,
			},
		});
		if (!permit) {
			throw new NotFoundException(`No permit with id ${permitId}.`);
		}

		const { playbook, ...rest } = permit;
		const template = playbook
			? parseWorksheetTemplate(playbook.worksheetTemplate)
			: [];
		const answers = parseWorksheetAnswers(permit.worksheetAnswers);
		const settings = await readPermitSettings(this.db);

		return {
			...rest,
			worksheetTemplate: template,
			worksheetAnswers: answers,
			worksheetStatus: this.worksheetStatus(
				template,
				answers,
				settings.disclaimer !== null,
			),
		};
	}

	async create(input: CreatePermitInput, userId: string) {
		const playbook = await this.playbooks.findOrCreate({
			jurisdictionId: input.jurisdictionId,
			permitType: input.permitType,
			typeLabel: input.typeLabel,
		});

		return this.db.$transaction(async (tx) => {
			const permit = await tx.permit.create({
				data: {
					dealId: input.dealId,
					jurisdictionId: input.jurisdictionId,
					playbookId: playbook.id,
					permitType: input.permitType,
					typeLabel: input.typeLabel ?? "",
					createdById: userId,
				},
			});

			if (playbook.facts.requiredDocuments.length > 0) {
				await tx.permitDocument.createMany({
					data: playbook.facts.requiredDocuments.map((doc, index) => ({
						permitId: permit.id,
						slotKey: doc.key,
						label: doc.label,
						sortOrder: index,
					})),
				});
			}

			if (playbook.facts.inspections.length > 0) {
				await tx.permitInspection.createMany({
					data: playbook.facts.inspections.map((inspection, index) => ({
						permitId: permit.id,
						name: inspection.name,
						criticalNote: inspection.criticalNote,
						sortOrder: index,
					})),
				});
			}

			return permit;
		});
	}

	async setStatus(input: SetPermitStatusInput) {
		return this.db.$transaction(async (tx) => {
			const permit = await tx.permit.findUnique({
				where: { id: input.permitId },
				include: { inspections: true },
			});
			if (!permit) {
				throw new NotFoundException(`No permit with id ${input.permitId}.`);
			}

			if (!canTransition(permit.status, input.status)) {
				throw new BadRequestException(
					`Cannot move a permit from ${permit.status} to ${input.status}.`,
				);
			}

			if (input.status === "CLOSED") {
				const hasUnpassed = permit.inspections.some(
					(inspection) => inspection.result !== "PASSED",
				);
				if (hasUnpassed) {
					throw new BadRequestException(
						"Every inspection must pass before a permit can be closed.",
					);
				}
			}

			if (input.status === "DENIED" && !input.deniedReason) {
				throw new BadRequestException("A denied permit needs a reason.");
			}

			const data: Prisma.PermitUpdateInput = { status: input.status };
			if (input.status === "SUBMITTED") data.submittedAt = new Date();
			if (input.status === "ISSUED") data.issuedAt = new Date();
			if (input.status === "CLOSED") data.closedAt = new Date();
			if (input.status === "DENIED") data.deniedReason = input.deniedReason;

			return tx.permit.update({ where: { id: input.permitId }, data });
		});
	}

	async update(input: UpdatePermitInput) {
		const data: Prisma.PermitUpdateInput = {};
		if (input.permitNumber !== undefined) {
			data.permitNumber = input.permitNumber;
		}
		if (input.feeCents !== undefined) data.feeCents = input.feeCents;
		if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;

		try {
			return await this.db.permit.update({
				where: { id: input.permitId },
				data,
			});
		} catch (error) {
			if (isNotFound(error)) {
				throw new NotFoundException(`No permit with id ${input.permitId}.`);
			}
			throw error;
		}
	}

	async setAnswer(input: SetPermitAnswerInput, userId: string) {
		await this.mutateAnswers(input.permitId, (answers) => ({
			...answers,
			[input.key]: {
				value: input.value,
				origin: "HUMAN",
				state: "APPROVED",
				approvedById: userId,
				approvedAt: new Date(),
			},
		}));
		return this.byId(input.permitId);
	}

	async approveAnswer(input: ApprovePermitAnswerInput, userId: string) {
		await this.mutateAnswers(input.permitId, (answers) => {
			const current = answers[input.key];
			const value = input.value ?? current?.value ?? "";
			return {
				...answers,
				[input.key]: {
					value,
					origin: current?.origin ?? "HUMAN",
					state: "APPROVED",
					approvedById: userId,
					approvedAt: new Date(),
				},
			};
		});
		return this.byId(input.permitId);
	}

	async approveAllReviewed(input: PermitIdInput, userId: string) {
		await this.mutateAnswers(input.permitId, (answers) => {
			const updated: WorksheetAnswers = {};
			for (const [key, answer] of Object.entries(answers)) {
				updated[key] =
					answer.state === "NEEDS_REVIEW"
						? {
								...answer,
								state: "APPROVED",
								approvedById: userId,
								approvedAt: new Date(),
							}
						: answer;
			}
			return updated;
		});
		return this.byId(input.permitId);
	}

	async clearAnswer(input: ClearPermitAnswerInput) {
		await this.mutateAnswers(input.permitId, (answers) => {
			const { [input.key]: _removed, ...rest } = answers;
			return rest;
		});
		return this.byId(input.permitId);
	}

	async applyPrefills(input: PermitIdInput) {
		const permit = await this.db.permit.findUnique({
			where: { id: input.permitId },
			select: { dealId: true, playbookId: true },
		});
		if (!permit) {
			throw new NotFoundException(`No permit with id ${input.permitId}.`);
		}
		if (!permit.playbookId) return this.byId(input.permitId);

		const playbook = await this.playbooks.byId(permit.playbookId);
		const values = await this.prefill.resolve(permit.dealId);

		await this.mutateAnswers(input.permitId, (answers) => {
			const updated = { ...answers };
			for (const field of playbook.worksheetTemplate) {
				if (!field.prefill) continue;
				const existing = updated[field.key];
				if (existing && existing.value !== "") continue;
				const resolved = values[field.prefill];
				if (resolved === "") continue;
				updated[field.key] = {
					value: resolved,
					origin: "CRM",
					state: "NEEDS_REVIEW",
					approvedById: null,
					approvedAt: null,
				};
			}
			return updated;
		});

		return this.byId(input.permitId);
	}

	async writeAgentAnswers(
		permitId: string,
		answers: Record<string, string>,
	): Promise<void> {
		const permit = await this.db.permit.findUnique({
			where: { id: permitId },
			select: { playbookId: true },
		});
		if (!permit) throw new NotFoundException(`No permit with id ${permitId}.`);
		if (!permit.playbookId) return;

		const playbook = await this.playbooks.byId(permit.playbookId);
		const templateKeys = new Set(
			playbook.worksheetTemplate.map((field) => field.key),
		);

		await this.mutateAnswers(permitId, (current) => {
			const updated = { ...current };
			for (const [key, value] of Object.entries(answers)) {
				if (!templateKeys.has(key)) continue;
				if (updated[key]?.state === "APPROVED") continue;
				updated[key] = {
					value,
					origin: "AI",
					state: "NEEDS_REVIEW",
					approvedById: null,
					approvedAt: null,
				};
			}
			return updated;
		});
	}

	async attachChecklistDocument(input: AttachChecklistDocumentInput) {
		return this.db.$transaction(async (tx) => {
			const existing = await tx.permitDocument.findUnique({
				where: {
					permitId_slotKey: {
						permitId: input.permitId,
						slotKey: input.slotKey,
					},
				},
			});
			if (!existing) {
				throw new NotFoundException(
					`No checklist slot "${input.slotKey}" on permit ${input.permitId}.`,
				);
			}

			if (input.lockerDocumentId === undefined) return existing;

			if (input.lockerDocumentId === null) {
				return tx.permitDocument.update({
					where: { id: existing.id },
					data: {
						lockerDocumentId: null,
						attachedAt: existing.filePath ? existing.attachedAt : null,
					},
				});
			}

			return tx.permitDocument.update({
				where: { id: existing.id },
				data: {
					lockerDocumentId: input.lockerDocumentId,
					attachedAt: new Date(),
				},
			});
		});
	}

	async lockerList() {
		const rows = await this.db.lockerDocument.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				label: true,
				kind: true,
				fileName: true,
				contentType: true,
				createdAt: true,
				_count: { select: { permitDocuments: true } },
			},
		});

		return rows.map(({ _count, ...row }) => ({
			...row,
			referencingCount: _count.permitDocuments,
		}));
	}

	async lockerRename(input: LockerRenameInput) {
		const data: Prisma.LockerDocumentUpdateInput = { label: input.label };
		if (input.kind !== undefined) data.kind = input.kind;

		try {
			return await this.db.lockerDocument.update({
				where: { id: input.lockerDocumentId },
				data,
			});
		} catch (error) {
			if (isNotFound(error)) {
				throw new NotFoundException(
					`No locker document with id ${input.lockerDocumentId}.`,
				);
			}
			throw error;
		}
	}

	async setInspection(input: SetInspectionInput) {
		if (input.inspectionId) {
			const data: Prisma.PermitInspectionUpdateInput = { name: input.name };
			if (input.scheduledFor !== undefined) {
				data.scheduledFor = input.scheduledFor;
			}
			if (input.result !== undefined) data.result = input.result;
			if (input.note !== undefined) data.note = input.note;

			try {
				return await this.db.permitInspection.update({
					where: { id: input.inspectionId },
					data,
				});
			} catch (error) {
				if (isNotFound(error)) {
					throw new NotFoundException(
						`No inspection with id ${input.inspectionId}.`,
					);
				}
				throw error;
			}
		}

		const count = await this.db.permitInspection.count({
			where: { permitId: input.permitId },
		});
		return this.db.permitInspection.create({
			data: {
				permitId: input.permitId,
				name: input.name,
				scheduledFor: input.scheduledFor ?? null,
				result: input.result ?? "PENDING",
				note: input.note ?? null,
				sortOrder: count,
			},
		});
	}

	async deleteInspection(input: InspectionIdInput) {
		try {
			await this.db.permitInspection.delete({
				where: { id: input.inspectionId },
			});
		} catch (error) {
			if (isNotFound(error)) {
				throw new NotFoundException(
					`No inspection with id ${input.inspectionId}.`,
				);
			}
			throw error;
		}
		return { id: input.inspectionId };
	}

	async dismissPrompt(input: PermitDealIdInput, userId: string) {
		await this.db.permitPromptDismissal.upsert({
			where: { dealId: input.dealId },
			create: { dealId: input.dealId, userId },
			update: { userId },
		});
		return { dealId: input.dealId };
	}

	async promptState(input: PermitDealIdInput) {
		const settings = await readPermitSettings(this.db);
		const deal = await this.db.deal.findUnique({
			where: { id: input.dealId },
			select: {
				stageId: true,
				drawings: {
					select: { address: true },
					orderBy: { updatedAt: "desc" },
					take: 1,
				},
			},
		});

		if (!deal)
			return { show: false, jurisdictionGuess: null, neededWhen: null };

		const [permitCount, dismissal] = await Promise.all([
			this.db.permit.count({ where: { dealId: input.dealId } }),
			this.db.permitPromptDismissal.findUnique({
				where: { dealId: input.dealId },
			}),
		]);

		const show =
			settings.permitsEnabled &&
			settings.permitTriggerStageIds.includes(deal.stageId) &&
			permitCount === 0 &&
			dismissal === null;

		const jurisdictionGuess = guessJurisdictionFromAddress(
			deal.drawings[0]?.address ?? null,
		);

		const neededWhen = jurisdictionGuess
			? await this.neededWhenFor(jurisdictionGuess)
			: null;

		return { show, jurisdictionGuess, neededWhen };
	}

	private async neededWhenFor(guess: {
		name: string;
		state: string;
	}): Promise<string | null> {
		const jurisdiction = await this.db.jurisdiction.findFirst({
			where: {
				state: guess.state,
				name: { equals: guess.name, mode: "insensitive" },
			},
		});
		if (!jurisdiction) return null;

		const playbook =
			(await this.db.permitPlaybook.findFirst({
				where: { jurisdictionId: jurisdiction.id, permitType: "BUILDING" },
			})) ??
			(await this.db.permitPlaybook.findFirst({
				where: { jurisdictionId: jurisdiction.id },
			}));
		if (!playbook) return null;

		return parsePlaybookFacts(playbook.facts).neededWhen?.value ?? null;
	}

	private worksheetStatus(
		template: { key: string; required: boolean }[],
		answers: WorksheetAnswers,
		disclaimerAccepted: boolean,
	) {
		const nonEmpty = Object.values(answers).filter(
			(answer) => answer.value !== "",
		);
		const allApproved = nonEmpty.every((answer) => answer.state === "APPROVED");
		const needsReviewCount = nonEmpty.filter(
			(answer) => answer.state === "NEEDS_REVIEW",
		).length;
		const requiredMissing = template
			.filter((field) => field.required)
			.filter((field) => (answers[field.key]?.value ?? "") === "")
			.map((field) => field.key);

		return {
			allApproved,
			requiredMissing,
			disclaimerAccepted,
			needsReviewCount,
		};
	}

	private worksheetGateFailure(
		template: WorksheetField[],
		answers: WorksheetAnswers,
		disclaimerAccepted: boolean,
	): string | null {
		const status = this.worksheetStatus(template, answers, disclaimerAccepted);

		if (status.needsReviewCount > 0) {
			const isSingular = status.needsReviewCount === 1;
			const noun = isSingular ? "field" : "fields";
			const verb = isSingular ? "awaits" : "await";
			return `${status.needsReviewCount} ${noun} ${verb} review.`;
		}

		const missingKey = status.requiredMissing[0];
		if (missingKey) {
			const label =
				template.find((field) => field.key === missingKey)?.label ?? missingKey;
			return `${label} is required.`;
		}

		if (!status.disclaimerAccepted) {
			return "Accept the preparation disclaimer first.";
		}

		return null;
	}

	async worksheetPdf(
		input: PermitIdInput,
	): Promise<{ filename: string; base64: string }> {
		const permit = await this.db.permit.findUnique({
			where: { id: input.permitId },
			include: {
				jurisdiction: true,
				deal: { select: { name: true, number: true, currency: true } },
				documents: { orderBy: { sortOrder: "asc" } },
				inspections: { orderBy: { sortOrder: "asc" } },
				playbook: true,
			},
		});
		if (!permit) {
			throw new NotFoundException(`No permit with id ${input.permitId}.`);
		}

		const template = permit.playbook
			? parseWorksheetTemplate(permit.playbook.worksheetTemplate)
			: [];
		const answers = parseWorksheetAnswers(permit.worksheetAnswers);
		const settings = await readPermitSettings(this.db);
		const disclaimerAccepted = settings.disclaimer !== null;

		const failure = this.worksheetGateFailure(
			template,
			answers,
			disclaimerAccepted,
		);
		if (failure) throw new BadRequestException(failure);

		const workspace = await this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: { name: true },
		});
		const workspaceName = workspace?.name ?? DEFAULT_WORKSPACE_NAME;
		const brand = await resolveEmailBrand(this.db);

		const checklistDocuments = permit.documents.filter(
			(document) => document.slotKey !== PERMITS.pdf.worksheetSlotKey,
		);

		const buffer = await renderPermitWorksheetPdf({
			workspaceName,
			accentColor: brand.color,
			permitTypeLabel: permit.typeLabel || PERMIT_TYPE_LABEL[permit.permitType],
			jurisdictionName: permit.jurisdiction.name,
			jurisdictionState: permit.jurisdiction.state,
			dealName: permit.deal.name,
			dealNumber: permit.deal.number,
			permitNumber: permit.permitNumber,
			feeCents: permit.feeCents,
			currency: permit.deal.currency,
			fields: template.map((field) => ({
				label: field.label,
				value: answers[field.key]?.value ?? "",
			})),
			checklist: checklistDocuments.map((document) => ({
				label: document.label,
				attached: document.attachedAt !== null,
			})),
			inspections: permit.inspections.map((inspection) => ({
				name: inspection.name,
				scheduledFor: inspection.scheduledFor,
				result: inspection.result,
			})),
		});

		const maxSortOrder = checklistDocuments.reduce(
			(max, document) => Math.max(max, document.sortOrder),
			-1,
		);

		const slot = await this.db.permitDocument.upsert({
			where: {
				permitId_slotKey: {
					permitId: permit.id,
					slotKey: PERMITS.pdf.worksheetSlotKey,
				},
			},
			create: {
				permitId: permit.id,
				slotKey: PERMITS.pdf.worksheetSlotKey,
				label: PERMITS.pdf.worksheetLabel,
				sortOrder: maxSortOrder + 1,
			},
			update: {},
			select: { id: true },
		});

		const savedFileName = await savePermitDocumentFile(slot.id, "pdf", buffer);

		await this.db.permitDocument.update({
			where: { id: slot.id },
			data: {
				...(savedFileName ? { filePath: savedFileName } : {}),
				attachedAt: new Date(),
			},
		});

		const filenameStem = this.filenameStem(
			`${permit.deal.number}-permit-worksheet`,
		);

		return {
			filename: `${filenameStem}.pdf`,
			base64: buffer.toString("base64"),
		};
	}

	private filenameStem(value: string): string {
		const stem = value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, PERMITS.pdf.maxFilenameStem);
		return stem || "permit-worksheet";
	}

	private async mutateAnswers(
		permitId: string,
		mutate: (answers: WorksheetAnswers) => WorksheetAnswers,
	): Promise<WorksheetAnswers> {
		return this.db.$transaction(async (tx) => {
			const permit = await tx.permit.findUnique({
				where: { id: permitId },
				select: { worksheetAnswers: true },
			});
			if (!permit) {
				throw new NotFoundException(`No permit with id ${permitId}.`);
			}

			const answers = parseWorksheetAnswers(permit.worksheetAnswers);
			const updated = mutate(answers);
			const saved = await tx.permit.update({
				where: { id: permitId },
				data: {
					worksheetAnswers: updated as PrismaNamespace.InputJsonValue,
				},
			});
			return parseWorksheetAnswers(saved.worksheetAnswers);
		});
	}
}
