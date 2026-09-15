import {
	ActivityType,
	type Db,
	type Prisma,
	Prisma as PrismaNamespace,
	ProductionStage,
	StageOutcome,
} from "@crm/db";
import {
	type AccessPrincipal,
	allows,
	refusalMessage,
} from "@crm/db/access-policy";
import {
	contactScopeWhere,
	dealScopeWhere,
	isUnscoped,
} from "@crm/db/access-scope";
import { normalizeCurrency } from "@crm/db/currency";
import {
	entryStageOf,
	isClosedStage,
	isWonStage,
	requiresReason,
} from "@crm/db/stage-semantics";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, requireOwner, runBulk } from "../crm/bulk";
import {
	blankToNull,
	decimalFromCents,
	fromCents,
	toCents,
} from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import { PermitTriggerService } from "../permits/permit-trigger.service";
import { parseNumberQuery } from "../search/search.config";
import {
	countsByKey,
	FACET_ALL,
	FACET_UNASSIGNED,
	type ListResult,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	ClosingWindow,
	DealAttachContactInput,
	DealBulkOwnerInput,
	DealBulkStageInput,
	DealContactRoleInput,
	DealCreateInput,
	DealDetachContactInput,
	DealListInput,
	DealUpdateInput,
	SetProductionStageInput,
	SetStageInput,
} from "./deals.contracts";
import { CLOSING_WINDOWS } from "./deals.contracts";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	phone: true,
	title: true,
	imageUrl: true,
} as const;

const STAGE_SELECT = {
	id: true,
	key: true,
	label: true,
	color: true,
	outcome: true,
	pipelineId: true,
} as const;

const STAGE_VALIDATE_SELECT = {
	...STAGE_SELECT,
	isEntry: true,
	archivedAt: true,
	pipeline: { select: { archivedAt: true } },
} as const;

const STAGE_NO_LONGER_EXISTS =
	"That stage no longer exists — pick a current one.";

const CLOSED_REASON_REQUIRED =
	"Say why it was lost — a closed-lost deal with no reason teaches nobody anything.";

type StageFacetMeta = {
	id: string;
	label: string;
	color: string;
	pipelineId: string;
};

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.DealOrderByWithRelationInput[]
> = {
	name: (dir) => [{ name: dir }],
	number: (dir) => [{ number: dir }],
	stage: (dir) => [{ stage: { position: dir } }, { expectedCloseDate: "asc" }],
	amount: (dir) => [{ baseAmount: { sort: dir, nulls: "last" } }],
	expectedCloseDate: (dir) => [{ expectedCloseDate: dir }],
	createdAt: (dir) => [{ createdAt: dir }],
	owner: (dir) => [{ owner: { name: dir } }, { name: "asc" }],
	lastActivity: (dir) => [{ lastActivityAt: { sort: dir, nulls: "last" } }],
};

@Injectable()
export class DealsService {
	private readonly logger = new Logger(DealsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly stamp: ActivityStampService,
		private readonly conversion: ConversionService,
		private readonly fields: FieldsService,
		private readonly permitTrigger: PermitTriggerService,
	) {}

	async list(input: DealListInput, p: AccessPrincipal) {
		const baseWhere = this.buildWhere(input);
		const scopeWhere = dealScopeWhere(p);
		const where: Prisma.DealWhereInput = { AND: [baseWhere, scopeWhere] };
		const { skip, take } = paginate(input);

		const { stageId: _ignoredStageId, ...restWhere } = baseWhere;
		const openWhere: Prisma.DealWhereInput = {
			AND: [
				{
					...restWhere,
					stage: {
						outcome: StageOutcome.OPEN,
						...(input.pipelineId ? { pipelineId: input.pipelineId } : {}),
					},
				},
				scopeWhere,
			],
		};
		const base = await this.conversion.reportingCurrency();

		const [rows, total, facets, openValue, unconverted] = await Promise.all([
			this.db.deal.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, [{ createdAt: "desc" }]),
				select: {
					id: true,
					name: true,
					number: true,
					stage: { select: STAGE_SELECT },
					productionStage: true,
					amount: true,
					currency: true,
					baseAmount: true,
					expectedCloseDate: true,
					closedAt: true,
					owner: { select: OWNER_SELECT },
					lastActivityAt: true,
					createdAt: true,
				},
			}),
			this.db.deal.count({ where }),
			this.facetCounts(input, p),
			this.db.deal.aggregate({
				where: { AND: [openWhere, this.conversion.countedWhere(base)] },
				_sum: { baseAmount: true },
			}),
			this.conversion.unconverted(openWhere),
		]);

		const tableFields = await this.fields.tableValuesFor(
			"DEAL",
			rows.map((row) => row.id),
		);

		return {
			rows: rows.map(
				({
					amount,
					baseAmount,
					expectedCloseDate,
					closedAt,
					lastActivityAt,
					createdAt,
					...row
				}) => ({
					...row,
					amountCents: toCents(amount),
					baseAmountCents: toCents(baseAmount),
					expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
					closedAt: closedAt?.toISOString() ?? null,
					lastActivityAt: lastActivityAt?.toISOString() ?? null,
					createdAt: createdAt.toISOString(),
					fields: tableFields.get(row.id) ?? {},
				}),
			),
			total,
			facetCounts: facets.counts,
			stages: facets.stages,
			openValueCents: toCents(openValue._sum.baseAmount),
			reportingCurrency: base,
			unconverted,
		} satisfies ListResult<unknown> & {
			stages: StageFacetMeta[];
			openValueCents: number | null;
			reportingCurrency: string;
			unconverted: { count: number; currencies: string[] };
		};
	}

	async byId(id: string, p: AccessPrincipal) {
		const deal = await this.db.deal.findFirst({
			where: { AND: [{ id }, dealScopeWhere(p)] },
			select: {
				id: true,
				name: true,
				number: true,
				description: true,
				stage: { select: STAGE_SELECT },
				productionStage: true,
				stageChangedAt: true,
				amount: true,
				currency: true,
				baseAmount: true,
				fxRate: true,
				fxRateAt: true,
				expectedCloseDate: true,
				closedAt: true,
				closedReason: true,
				createdAt: true,
				owner: { select: OWNER_SELECT },
				contacts: {
					select: { role: true, contact: { select: CONTACT_SELECT } },
					orderBy: { contact: { firstName: "asc" } },
				},
			},
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${id}.`);
		}

		const { contacts, amount, baseAmount, fxRate, fxRateAt, ...rest } = deal;

		return {
			...rest,
			fields: await this.fields.valuesFor("DEAL", id),
			amountCents: toCents(amount),
			baseAmountCents: toCents(baseAmount),
			reportingCurrency: await this.conversion.reportingCurrency(),
			fxRate: fxRate?.toNumber() ?? null,
			fxRateAt: fxRateAt?.toISOString() ?? null,
			stageChangedAt: deal.stageChangedAt.toISOString(),
			expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
			closedAt: deal.closedAt?.toISOString() ?? null,
			createdAt: deal.createdAt.toISOString(),
			contacts: contacts.map(({ role, contact }) => ({ ...contact, role })),
		};
	}

	async create(input: DealCreateInput, p: AccessPrincipal) {
		const ownerId = isUnscoped(p) ? input.ownerId : p.userId;
		const stage = input.stage
			? await this.resolveStage(input.stage)
			: await this.defaultEntryStage();
		const closedReason = input.closedReason?.trim();

		if (requiresReason(stage) && !closedReason) {
			throw new BadRequestException(CLOSED_REASON_REQUIRED);
		}

		const closed = isClosedStage(stage);
		const now = new Date();

		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const fx = await this.conversion.dealFields(
			decimalFromCents(input.amountCents),
			currency,
		);

		try {
			const deal = await this.agent.withCrmEvents(async (tx, emit) => {
				const created = await tx.deal.create({
					data: {
						name: input.name.trim(),
						ownerId,
						stageId: stage.id,
						stageChangedAt: now,
						closedAt: closed ? now : null,
						closedReason: closed ? (closedReason ?? null) : null,
						amount: fromCents(input.amountCents),
						currency,
						...fx,
						expectedCloseDate: parseDate(input.expectedCloseDate),
					},
					select: { id: true, name: true },
				});
				await emit({
					type: "deal.created",
					record: { kind: "deal", id: created.id },
					occurredAt: now,
					data: { stage: stage.key },
				});
				if (closed) {
					await emit({
						type: "deal.closed",
						record: { kind: "deal", id: created.id },
						occurredAt: now,
						data: { from: null, to: stage.key },
					});
				}
				return created;
			});

			this.logger.log({
				message: "Deal created",
				dealId: deal.id,
				stage: stage.key,
			});

			return deal;
		} catch (error) {
			throw this.translateRelations(error);
		}
	}

	async update(id: string, input: DealUpdateInput, p: AccessPrincipal) {
		await this.assertInScope(id, p);

		const data: Prisma.DealUpdateInput = {};

		if (input.name !== undefined) data.name = input.name.trim();
		if (input.description !== undefined) {
			data.description =
				input.description === null ? null : blankToNull(input.description);
		}
		if (input.ownerId !== undefined) {
			this.assertOwnerAssignable(input.ownerId, p);
			data.owner = { connect: { id: input.ownerId } };
		}
		if (input.amountCents !== undefined) {
			data.amount = fromCents(input.amountCents);
		}
		if (input.currency !== undefined) {
			data.currency = normalizeCurrency(input.currency);
		}
		if (input.expectedCloseDate !== undefined) {
			data.expectedCloseDate = parseDate(input.expectedCloseDate);
		}

		if (input.amountCents !== undefined || input.currency !== undefined) {
			const current = await this.db.deal.findUnique({
				where: { id },
				select: { amount: true, currency: true },
			});

			if (!current) {
				throw new NotFoundException(`No deal with id ${id}.`);
			}

			const amount =
				input.amountCents !== undefined
					? decimalFromCents(input.amountCents)
					: current.amount;
			const currency =
				input.currency !== undefined
					? normalizeCurrency(input.currency)
					: normalizeCurrency(current.currency);

			Object.assign(data, await this.conversion.dealFields(amount, currency));
		}

		try {
			return await this.db.$transaction(async (tx) => {
				if (input.fields) {
					await this.fields.applyValues(tx, "DEAL", id, input.fields);
				}

				return tx.deal.update({
					where: { id },
					data,
					select: { id: true, name: true },
				});
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async delete(
		id: string,
		p: AccessPrincipal,
	): Promise<{ id: string; name: string }> {
		await this.assertInScope(id, p);

		let deleted: { targets: StampTargets; name: string };

		try {
			deleted = await this.db.$transaction(async (tx) => {
				const targets = await this.stamp.targetsOf({ dealId: id }, tx);
				await tx.agentTask.deleteMany({ where: { dealId: id } });

				const deal = await tx.deal.delete({
					where: { id },
					select: { name: true },
				});

				return { targets, name: deal.name };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		await this.stamp.recomputeAfterDelete(deleted.targets, { dealId: id });

		this.logger.log({
			message: "Deal deleted",
			dealId: id,
			name: deleted.name,
		});

		return { id, name: deleted.name };
	}

	async setStage(
		input: SetStageInput,
		actingUserId: string,
		p: AccessPrincipal,
	) {
		await this.assertInScope(input.id, p);

		const closedReason = input.closedReason?.trim();

		const transition = await this.agent.withCrmEvents(async (tx, emit) => {
			const [deal] = await tx.$queryRaw<Array<{ id: string; stageId: string }>>`
				SELECT id, "stageId"
				FROM deal
				WHERE id = ${input.id}
				FOR UPDATE
			`;

			if (!deal) {
				throw new NotFoundException(`No deal with id ${input.id}.`);
			}

			if (deal.stageId === input.stage) {
				return {
					changed: false as const,
					updated: { id: deal.id, stageId: deal.stageId },
					now: null,
					fromKey: null,
					toKey: null,
				};
			}

			const fromStage = await tx.stage.findUniqueOrThrow({
				where: { id: deal.stageId },
				select: STAGE_VALIDATE_SELECT,
			});
			const targetStage = await this.resolveStage(input.stage, tx);

			if (requiresReason(targetStage) && !closedReason) {
				throw new BadRequestException(CLOSED_REASON_REQUIRED);
			}

			const closed = isClosedStage(targetStage);
			const now = new Date();
			const updated = await tx.deal.update({
				where: { id: input.id },
				data: {
					stageId: targetStage.id,
					stageChangedAt: now,
					closedAt: closed ? now : null,
					closedReason: closed ? (closedReason ?? null) : null,
				},
				select: { id: true, stageId: true },
			});
			await tx.activity.create({
				data: {
					type: ActivityType.STAGE_CHANGE,
					subject: "Stage changed",
					body: closedReason ?? null,
					occurredAt: now,
					dealId: deal.id,
					createdById: actingUserId,
					meta: { from: fromStage.key, to: targetStage.key },
				},
			});
			await emit({
				type: "deal.stage.changed",
				record: { kind: "deal", id: deal.id },
				occurredAt: now,
				data: { from: fromStage.key, to: targetStage.key },
			});
			if (!isClosedStage(fromStage) && closed) {
				await emit({
					type: "deal.closed",
					record: { kind: "deal", id: deal.id },
					occurredAt: now,
					data: {
						from: fromStage.key,
						to: targetStage.key,
					},
				});
			}
			if (isClosedStage(fromStage) && !closed) {
				await emit({
					type: "deal.opened",
					record: { kind: "deal", id: deal.id },
					occurredAt: now,
					data: {
						from: fromStage.key,
						to: targetStage.key,
					},
				});
			}

			return {
				changed: true as const,
				updated,
				now,
				fromKey: fromStage.key,
				toKey: targetStage.key,
			};
		});

		if (!transition.changed) {
			return { ...transition.updated, changed: false };
		}

		const { updated, now, fromKey, toKey } = transition;

		await this.stamp.touch({ dealId: updated.id }, now);
		await this.permitTrigger.onStageChanged(updated.id, updated.stageId);

		this.logger.log({
			message: "Deal stage changed",
			dealId: updated.id,
			from: fromKey,
			to: toKey,
		});

		return { ...updated, changed: true };
	}

	/** Field Mode — a crew's active work list. Won jobs whose production stage is
	 * one a crew is actively on (scheduled / in progress / on hold); COMPLETE and
	 * PAID have left the shop floor and drop off. Ordered most-recently-moved
	 * first so the job just touched sits on top. Each row carries the primary
	 * reachable contact (first attached contact with a phone) so the mobile field
	 * UI can one-tap Call without a second round-trip. Read-only. */
	async fieldToday(p: AccessPrincipal) {
		const ACTIVE_PRODUCTION = [
			ProductionStage.SCHEDULED,
			ProductionStage.IN_PROGRESS,
			ProductionStage.ON_HOLD,
		];

		const rows = await this.db.deal.findMany({
			where: {
				AND: [
					{
						stage: { outcome: StageOutcome.WON },
						productionStage: { in: ACTIVE_PRODUCTION },
					},
					dealScopeWhere(p),
				],
			},
			orderBy: [
				{ productionStageChangedAt: { sort: "desc", nulls: "last" } },
				{ createdAt: "desc" },
			],
			select: {
				id: true,
				name: true,
				amount: true,
				currency: true,
				productionStage: true,
				contacts: {
					select: { contact: { select: CONTACT_SELECT } },
					orderBy: { contact: { firstName: "asc" } },
				},
			},
		});

		return rows.map(({ amount, contacts, ...row }) => {
			// First attached contact with a usable phone is the one to call; fall
			// back to the first contact so a nameless card never ships.
			const withPhone = contacts.find(
				(c) => c.contact.phone && c.contact.phone.trim().length > 0,
			);
			const reachable = (withPhone ?? contacts[0])?.contact ?? null;
			return {
				...row,
				amountCents: toCents(amount),
				contact: reachable
					? {
							id: reachable.id,
							firstName: reachable.firstName,
							lastName: reachable.lastName,
							phone: reachable.phone,
						}
					: null,
			};
		});
	}

	/** Move a WON deal along the production pipeline (or back to Unscheduled with
	 * `stage: null`). Guarded to won jobs only — the sales pipeline owns every
	 * pre-win transition; production is strictly post-win work. */
	async setProductionStage(
		input: SetProductionStageInput,
		actingUserId: string,
		p: AccessPrincipal,
	) {
		if (
			!allows(p, "deals", "EDIT") &&
			input.stage !== ProductionStage.COMPLETE
		) {
			throw new ForbiddenException(refusalMessage(p, "deals", "EDIT"));
		}

		const deal = await this.db.deal.findFirst({
			where: { AND: [{ id: input.id }, dealScopeWhere(p)] },
			select: {
				id: true,
				productionStage: true,
				stage: { select: { outcome: true } },
			},
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${input.id}.`);
		}
		if (!isWonStage(deal.stage)) {
			throw new BadRequestException(
				"Only won jobs move through production — win the deal first.",
			);
		}
		if (deal.productionStage === input.stage) {
			return {
				id: deal.id,
				productionStage: deal.productionStage,
				changed: false as const,
			};
		}

		const now = new Date();
		const updated = await this.db.deal.update({
			where: { id: input.id },
			data: { productionStage: input.stage, productionStageChangedAt: now },
			select: { id: true, productionStage: true },
		});
		await this.db.activity.create({
			data: {
				type: ActivityType.STAGE_CHANGE,
				subject: "Production stage changed",
				occurredAt: now,
				dealId: deal.id,
				createdById: actingUserId,
				meta: {
					kind: "production",
					from: deal.productionStage,
					to: input.stage,
				},
			},
		});

		return { ...updated, changed: true as const };
	}

	async contactOptions(dealId: string, p: AccessPrincipal) {
		const deal = await this.db.deal.findFirst({
			where: { AND: [{ id: dealId }, dealScopeWhere(p)] },
			select: { contacts: { select: { contactId: true } } },
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${dealId}.`);
		}

		return this.db.contact.findMany({
			where: {
				AND: [
					{ id: { notIn: deal.contacts.map((row) => row.contactId) } },
					contactScopeWhere(p),
				],
			},
			select: CONTACT_SELECT,
			orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
			take: 100,
		});
	}

	async attachContact(input: DealAttachContactInput, p: AccessPrincipal) {
		const deal = await this.db.deal.findFirst({
			where: { AND: [{ id: input.dealId }, dealScopeWhere(p)] },
			select: { id: true },
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${input.dealId}.`);
		}

		const contact = await this.db.contact.findFirst({
			where: { AND: [{ id: input.contactId }, contactScopeWhere(p)] },
			select: { id: true },
		});

		if (!contact) {
			throw new NotFoundException(`No contact with id ${input.contactId}.`);
		}

		const role = roleOrNull(input.role ?? null);

		await this.db.dealContact.upsert({
			where: {
				dealId_contactId: {
					dealId: input.dealId,
					contactId: input.contactId,
				},
			},
			create: { dealId: input.dealId, contactId: input.contactId, role },
			update: role === null ? {} : { role },
		});

		this.logger.log({
			message: "Contact attached to deal",
			dealId: input.dealId,
			contactId: input.contactId,
		});

		return { dealId: input.dealId, contactId: input.contactId };
	}

	async detachContact(input: DealDetachContactInput, p: AccessPrincipal) {
		await this.assertInScope(input.dealId, p);

		const { count } = await this.db.dealContact.deleteMany({
			where: { dealId: input.dealId, contactId: input.contactId },
		});

		if (count === 0) {
			throw new NotFoundException("That contact is not on this deal.");
		}

		this.logger.log({
			message: "Contact detached from deal",
			dealId: input.dealId,
			contactId: input.contactId,
		});

		return { dealId: input.dealId, contactId: input.contactId };
	}

	async setContactRole(input: DealContactRoleInput, p: AccessPrincipal) {
		await this.assertInScope(input.dealId, p);

		const role = roleOrNull(input.role);

		const { count } = await this.db.dealContact.updateMany({
			where: { dealId: input.dealId, contactId: input.contactId },
			data: { role },
		});

		if (count === 0) {
			throw new NotFoundException("That contact is not on this deal.");
		}

		return { dealId: input.dealId, contactId: input.contactId, role };
	}

	async bulkAssignOwner(
		input: DealBulkOwnerInput,
		p: AccessPrincipal,
	): Promise<BulkResult> {
		this.assertOwnerAssignable(input.ownerId, p);
		await requireOwner(this.db, input.ownerId);

		const ids = [...new Set(input.ids)];
		await this.assertAllInScope(ids, p);
		const { count } = await this.db.deal.updateMany({
			where: { id: { in: ids } },
			data: { ownerId: input.ownerId },
		});

		this.logger.log({
			message: "Deals reassigned",
			count,
			ownerId: input.ownerId,
		});

		return {
			requested: ids.length,
			succeeded: count,
			failed: ids.length - count,
			message: null,
		};
	}

	async bulkSetStage(
		input: DealBulkStageInput,
		actingUserId: string,
		p: AccessPrincipal,
	): Promise<BulkResult> {
		await this.assertAllInScope(input.ids, p);

		const closedReason = input.closedReason?.trim();
		const stage = await this.resolveStage(input.stage);

		if (requiresReason(stage) && !closedReason) {
			throw new BadRequestException(
				"Say why they were lost — a closed-lost deal with no reason teaches nobody anything.",
			);
		}

		return runBulk(input.ids, (id) =>
			this.setStage({ id, stage: input.stage, closedReason }, actingUserId, p),
		);
	}

	async bulkDelete(ids: string[], p: AccessPrincipal): Promise<BulkResult> {
		await this.assertAllInScope(ids, p);
		return runBulk(ids, (id) => this.delete(id, p));
	}

	private searchFilter(q: string): Prisma.DealWhereInput {
		const term = q.trim();
		if (!term) return {};

		const or: Prisma.DealWhereInput[] = [
			{ name: { contains: term, mode: "insensitive" } },
		];

		const asNumber = parseNumberQuery(term);
		if (asNumber !== null) {
			or.push({ number: asNumber });
		}

		return { OR: or };
	}

	private buildWhere(input: DealListInput): Prisma.DealWhereInput {
		const where: Prisma.DealWhereInput = this.searchFilter(input.q);

		if (input.owner !== FACET_ALL) {
			where.ownerId =
				input.owner === FACET_UNASSIGNED ? { in: [] } : input.owner;
		}

		const stageWhere: Prisma.StageWhereInput = {};

		if (input.status === "open") {
			stageWhere.outcome = StageOutcome.OPEN;
		} else if (input.status === "closed") {
			stageWhere.outcome = { not: StageOutcome.OPEN };
		}

		if (input.wonOnly) {
			stageWhere.outcome = StageOutcome.WON;
		}

		if (input.pipelineId) {
			stageWhere.pipelineId = input.pipelineId;
		}

		if (input.stage !== FACET_ALL) {
			where.stageId = input.stage;
		}

		if (input.closing !== FACET_ALL) {
			if (!CLOSING_WINDOWS.includes(input.closing as ClosingWindow)) {
				throw new BadRequestException(
					`"${input.closing}" is not a closing window.`,
				);
			}
			const { stage: closingStageWhere, ...rest } = closingFilter(
				input.closing as ClosingWindow,
			);
			Object.assign(where, rest);
			if (closingStageWhere) {
				Object.assign(stageWhere, closingStageWhere);
			}
		}

		if (Object.keys(stageWhere).length > 0) {
			where.stage = stageWhere;
		}

		return where;
	}

	private async facetCounts(
		input: DealListInput,
		p: AccessPrincipal,
	): Promise<{
		counts: {
			status: { open: number; closed: number };
			owner: Record<string, number>;
			stage: Record<string, number>;
			closing: Record<string, number>;
		};
		stages: StageFacetMeta[];
	}> {
		const searchWhere = this.searchFilter(input.q);
		const scopeWhere = dealScopeWhere(p);
		const where: Prisma.DealWhereInput = { AND: [searchWhere, scopeWhere] };

		const [owners, stageGroups, ...closingCounts] = await Promise.all([
			this.db.deal.groupBy({ by: ["ownerId"], where, _count: { _all: true } }),
			this.db.deal.groupBy({ by: ["stageId"], where, _count: { _all: true } }),
			...CLOSING_WINDOWS.map((window) =>
				this.db.deal.count({
					where: { AND: [searchWhere, closingFilter(window), scopeWhere] },
				}),
			),
		]);

		const stageCounts = countsByKey(stageGroups, "stageId");
		const stageIds = stageGroups.map((group) => group.stageId);
		const stageRows = stageIds.length
			? await this.db.stage.findMany({
					where: { id: { in: stageIds } },
					select: {
						id: true,
						label: true,
						color: true,
						pipelineId: true,
						outcome: true,
					},
				})
			: [];

		let openCount = 0;
		let closedCount = 0;
		for (const group of stageGroups) {
			const stage = stageRows.find((row) => row.id === group.stageId);
			const count = group._count._all;
			if (stage?.outcome === StageOutcome.OPEN) {
				openCount += count;
			} else {
				closedCount += count;
			}
		}

		return {
			counts: {
				status: { open: openCount, closed: closedCount },
				owner: countsByKey(owners, "ownerId", FACET_UNASSIGNED),
				stage: stageCounts,
				closing: Object.fromEntries(
					CLOSING_WINDOWS.map((window, index) => [
						window,
						closingCounts[index] ?? 0,
					]),
				),
			},
			stages: stageRows.map(({ outcome, ...meta }) => meta),
		};
	}

	private async resolveStage(
		id: string,
		client: Db | Prisma.TransactionClient = this.db,
	): Promise<Prisma.StageGetPayload<{ select: typeof STAGE_VALIDATE_SELECT }>> {
		const stage = await client.stage.findUnique({
			where: { id },
			select: STAGE_VALIDATE_SELECT,
		});

		if (!stage || stage.archivedAt || stage.pipeline.archivedAt) {
			throw new BadRequestException(STAGE_NO_LONGER_EXISTS);
		}

		return stage;
	}

	private async defaultEntryStage(): Promise<
		Prisma.StageGetPayload<{ select: typeof STAGE_VALIDATE_SELECT }>
	> {
		const pipeline = await this.db.pipeline.findFirst({
			where: { archivedAt: null },
			orderBy: { position: "asc" },
			select: {
				stages: {
					where: { archivedAt: null },
					select: STAGE_VALIDATE_SELECT,
				},
			},
		});

		const entry = pipeline ? entryStageOf(pipeline.stages) : undefined;

		if (!entry) {
			throw new BadRequestException(
				"No pipeline has an entry stage set up yet.",
			);
		}

		return entry;
	}

	private async assertInScope(id: string, p: AccessPrincipal): Promise<void> {
		const found = await this.db.deal.findFirst({
			where: { AND: [{ id }, dealScopeWhere(p)] },
			select: { id: true },
		});
		if (!found) throw new NotFoundException(`No deal with id ${id}.`);
	}

	private async assertAllInScope(
		ids: string[],
		p: AccessPrincipal,
	): Promise<void> {
		const unique = [...new Set(ids)];
		const found = await this.db.deal.findMany({
			where: { AND: [{ id: { in: unique } }, dealScopeWhere(p)] },
			select: { id: true },
		});
		if (found.length !== unique.length) {
			const visible = new Set(found.map((row) => row.id));
			const missing = unique.find((id) => !visible.has(id));
			throw new NotFoundException(`No deal with id ${missing}.`);
		}
	}

	private assertOwnerAssignable(ownerId: string, p: AccessPrincipal): void {
		if (isUnscoped(p) || ownerId === p.userId) return;
		if (!p.groupName) {
			throw new ForbiddenException(
				"You aren't in a group yet, so you can't give deals to other people. Ask an admin.",
			);
		}
		throw new ForbiddenException(
			`Your group (${p.groupName}) can't give deals to other people. Ask an admin.`,
		);
	}

	private translate(error: unknown, id: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No deal with id ${id}.`);
		}
		return this.translateRelations(error);
	}

	private translateRelations(error: unknown): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			(error.code === "P2003" || error.code === "P2025")
		) {
			return new BadRequestException("That owner does not exist any more.");
		}
		return error;
	}
}

function closingFilter(window: ClosingWindow): Prisma.DealWhereInput {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const startOfMonthAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);

	switch (window) {
		case "overdue":
			return {
				expectedCloseDate: { lt: now },
				stage: { outcome: StageOutcome.OPEN },
			};
		case "this-month":
			return {
				expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
			};
		case "next-month":
			return {
				expectedCloseDate: { gte: startOfNextMonth, lt: startOfMonthAfter },
			};
		case "later":
			return { expectedCloseDate: { gte: startOfMonthAfter } };
		case "none":
			return { expectedCloseDate: null };
		default:
			throw new BadRequestException(`"${window}" is not a closing window.`);
	}
}

function roleOrNull(value: string | null): string | null {
	return value === null ? null : blankToNull(value);
}

function parseDate(value: string | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`"${value}" is not a date.`);
	}
	return date;
}
