import { type Db, type Prisma, Prisma as PrismaNamespace } from "@crm/db";
import {
	mergeDraftFacts,
	type PlaybookFacts,
	type ProvenanceFact,
	parsePlaybookFacts,
	parseWorksheetTemplate,
	worksheetTemplate,
} from "@crm/db/permits";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { PERMITS } from "./permits.config";
import {
	FACT_SINGLETON_PATHS,
	type FactSingletonPath,
	type PlaybookFactPathInput,
	type PlaybookInput,
	PREREQUISITE_PATH,
	type SetPlaybookDocumentsInput,
	type SetPlaybookFactInput,
	type SetPlaybookInspectionsInput,
	type SetWorksheetTemplateInput,
} from "./permits.contracts";

type PermitPlaybookRow = {
	id: string;
	jurisdictionId: string;
	permitType: string;
	typeLabel: string;
	facts: unknown;
	worksheetTemplate: unknown;
	createdAt: Date;
	updatedAt: Date;
};

function isSingletonPath(path: string): path is FactSingletonPath {
	return (FACT_SINGLETON_PATHS as readonly string[]).includes(path);
}

function prerequisiteIndex(path: string): number {
	const match = path.match(PREREQUISITE_PATH);
	if (!match?.[1]) {
		throw new BadRequestException(`Unknown fact path "${path}".`);
	}
	return Number(match[1]);
}

function toJsonFact(
	fact: ProvenanceFact | null,
): PrismaNamespace.InputJsonValue {
	if (!fact) return null as unknown as PrismaNamespace.InputJsonValue;
	return {
		value: fact.value,
		sourceUrl: fact.sourceUrl,
		verifiedById: fact.verifiedById,
		verifiedAt: fact.verifiedAt ? fact.verifiedAt.toISOString() : null,
	} as PrismaNamespace.InputJsonValue;
}

function factsToJson(facts: PlaybookFacts): PrismaNamespace.InputJsonValue {
	return {
		neededWhen: toJsonFact(facts.neededWhen),
		whoMayPull: toJsonFact(facts.whoMayPull),
		prerequisites: facts.prerequisites.map((fact) => toJsonFact(fact)),
		howToApply: toJsonFact(facts.howToApply),
		feeSchedule: toJsonFact(facts.feeSchedule),
		typicalTurnaround: toJsonFact(facts.typicalTurnaround),
		requiredDocuments: facts.requiredDocuments,
		inspections: facts.inspections,
	} as PrismaNamespace.InputJsonValue;
}

@Injectable()
export class PlaybooksService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async findOrCreate(input: PlaybookInput) {
		const typeLabel = input.typeLabel ?? "";
		const existing = await this.db.permitPlaybook.findUnique({
			where: {
				jurisdictionId_permitType_typeLabel: {
					jurisdictionId: input.jurisdictionId,
					permitType: input.permitType,
					typeLabel,
				},
			},
		});
		if (existing) return this.serialize(existing);

		try {
			const created = await this.db.permitPlaybook.create({
				data: {
					jurisdictionId: input.jurisdictionId,
					permitType: input.permitType,
					typeLabel,
				},
			});
			return this.serialize(created);
		} catch (error) {
			throw this.translate(error, input.jurisdictionId);
		}
	}

	async byId(id: string) {
		const row = await this.db.permitPlaybook.findUnique({ where: { id } });
		if (!row) {
			throw new NotFoundException(`No playbook with id ${id}.`);
		}
		return this.serialize(row);
	}

	async setFact(input: SetPlaybookFactInput) {
		return this.db.$transaction(async (tx) => {
			const playbook = await this.load(tx, input.playbookId);
			const facts = parsePlaybookFacts(playbook.facts);
			const fact: ProvenanceFact = {
				value: input.value,
				sourceUrl: input.sourceUrl ?? null,
				verifiedById: null,
				verifiedAt: null,
			};
			const updated = this.writeAtPath(facts, input.factPath, fact);
			const saved = await tx.permitPlaybook.update({
				where: { id: input.playbookId },
				data: { facts: factsToJson(updated) },
			});
			return this.serialize(saved);
		});
	}

	async verifyFact(input: PlaybookFactPathInput, userId: string) {
		return this.db.$transaction(async (tx) => {
			const playbook = await this.load(tx, input.playbookId);
			const facts = parsePlaybookFacts(playbook.facts);
			const current = this.readAtPath(facts, input.factPath);
			if (!current) {
				throw new BadRequestException(
					`No fact set at path "${input.factPath}".`,
				);
			}
			const verified: ProvenanceFact = {
				...current,
				verifiedById: userId,
				verifiedAt: new Date(),
			};
			const updated = this.writeAtPath(facts, input.factPath, verified);
			const saved = await tx.permitPlaybook.update({
				where: { id: input.playbookId },
				data: { facts: factsToJson(updated) },
			});
			return this.serialize(saved);
		});
	}

	async clearFact(input: PlaybookFactPathInput) {
		return this.db.$transaction(async (tx) => {
			const playbook = await this.load(tx, input.playbookId);
			const facts = parsePlaybookFacts(playbook.facts);
			const updated = this.clearAtPath(facts, input.factPath);
			const saved = await tx.permitPlaybook.update({
				where: { id: input.playbookId },
				data: { facts: factsToJson(updated) },
			});
			return this.serialize(saved);
		});
	}

	async setDocuments(input: SetPlaybookDocumentsInput) {
		return this.db.$transaction(async (tx) => {
			const playbook = await this.load(tx, input.playbookId);
			const facts = parsePlaybookFacts(playbook.facts);
			const updated: PlaybookFacts = {
				...facts,
				requiredDocuments: input.documents,
			};
			const saved = await tx.permitPlaybook.update({
				where: { id: input.playbookId },
				data: { facts: factsToJson(updated) },
			});
			return this.serialize(saved);
		});
	}

	async setInspections(input: SetPlaybookInspectionsInput) {
		return this.db.$transaction(async (tx) => {
			const playbook = await this.load(tx, input.playbookId);
			const facts = parsePlaybookFacts(playbook.facts);
			const updated: PlaybookFacts = {
				...facts,
				inspections: input.inspections,
			};
			const saved = await tx.permitPlaybook.update({
				where: { id: input.playbookId },
				data: { facts: factsToJson(updated) },
			});
			return this.serialize(saved);
		});
	}

	async setWorksheetTemplate(input: SetWorksheetTemplateInput) {
		const parsed = worksheetTemplate.safeParse(input.fields);
		if (!parsed.success) {
			throw new BadRequestException(parsed.error.issues[0]?.message);
		}
		await this.load(this.db, input.playbookId);
		const saved = await this.db.permitPlaybook.update({
			where: { id: input.playbookId },
			data: {
				worksheetTemplate: parsed.data as PrismaNamespace.InputJsonValue,
			},
		});
		return this.serialize(saved);
	}

	async upsertDraftFacts(playbookId: string, draft: PlaybookFacts) {
		return this.db.$transaction(async (tx) => {
			const playbook = await this.load(tx, playbookId);
			const existing = parsePlaybookFacts(playbook.facts);
			const merged = mergeDraftFacts(existing, draft);
			const saved = await tx.permitPlaybook.update({
				where: { id: playbookId },
				data: { facts: factsToJson(merged) },
			});
			return this.serialize(saved);
		});
	}

	private async load(
		client: Db | Prisma.TransactionClient,
		playbookId: string,
	): Promise<PermitPlaybookRow> {
		const playbook = await client.permitPlaybook.findUnique({
			where: { id: playbookId },
		});
		if (!playbook) {
			throw new NotFoundException(`No playbook with id ${playbookId}.`);
		}
		return playbook;
	}

	private readAtPath(
		facts: PlaybookFacts,
		factPath: string,
	): ProvenanceFact | null {
		if (isSingletonPath(factPath)) return facts[factPath];
		return facts.prerequisites[prerequisiteIndex(factPath)] ?? null;
	}

	private writeAtPath(
		facts: PlaybookFacts,
		factPath: string,
		fact: ProvenanceFact,
	): PlaybookFacts {
		if (isSingletonPath(factPath)) return { ...facts, [factPath]: fact };

		const index = prerequisiteIndex(factPath);
		if (index > facts.prerequisites.length) {
			throw new BadRequestException(
				`Prerequisite index ${index} is out of range.`,
			);
		}
		if (
			index === facts.prerequisites.length &&
			facts.prerequisites.length >= PERMITS.playbook.maxPrerequisites
		) {
			throw new BadRequestException(
				`A playbook can have at most ${PERMITS.playbook.maxPrerequisites} prerequisites.`,
			);
		}
		const prerequisites = [...facts.prerequisites];
		prerequisites[index] = fact;
		return { ...facts, prerequisites };
	}

	private clearAtPath(facts: PlaybookFacts, factPath: string): PlaybookFacts {
		if (isSingletonPath(factPath)) return { ...facts, [factPath]: null };

		const index = prerequisiteIndex(factPath);
		if (index >= facts.prerequisites.length) {
			throw new NotFoundException(`No prerequisite at index ${index}.`);
		}
		return {
			...facts,
			prerequisites: facts.prerequisites.filter((_, i) => i !== index),
		};
	}

	private serialize(row: PermitPlaybookRow) {
		return {
			...row,
			facts: parsePlaybookFacts(row.facts),
			worksheetTemplate: parseWorksheetTemplate(row.worksheetTemplate),
		};
	}

	private translate(error: unknown, jurisdictionId: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2003"
		) {
			return new NotFoundException(
				`No jurisdiction with id ${jurisdictionId}.`,
			);
		}
		return error;
	}
}
