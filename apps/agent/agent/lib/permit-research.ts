import {
	db,
	JurisdictionKind,
	PermitType,
	Prisma as PrismaNamespace,
} from "@crm/db";
import {
	buildJurisdictionMatchKey,
	mergeDraftFacts,
	type PlaybookFacts,
	type ProvenanceFact,
	parsePlaybookFacts,
	parseWorksheetAnswers,
	parseWorksheetTemplate,
	type WorksheetField,
} from "@crm/db/permits";
import { z } from "zod";
import { fenceUntrusted } from "./untrusted";

export const RESEARCH_RULES = [
	"**Research rules for a permit playbook:**",
	"",
	"- Official sources only — the issuing authority's own domain (a city, county",
	"  or state government site). A contractor forum, a blog or a third-party",
	"  permit-expediting service is not a source, however accurate it looks.",
	"- No source, no fact. Every fact you draft carries the exact page you read it",
	"  on. If you cannot find an official page that says it, leave the fact out.",
	'- Never infer from general knowledge. Do not fill in what is "usually true"',
	"  of permits like this one — read the jurisdiction's own page for this",
	"  jurisdiction and this permit type.",
	"- A fee is copied as text, with its URL, exactly as the authority states it —",
	"  never converted, estimated or rounded.",
	"- Everything you write is a draft. It lands unverified, and a person at the",
	"  business verifies it against the source before anyone relies on it.",
].join("\n");

const draftProvenanceFact = z.object({
	value: z.string().trim().min(1).max(2000),
	sourceUrl: z.string().trim().url().max(500).nullable().optional(),
});
export type DraftProvenanceFact = z.infer<typeof draftProvenanceFact>;

const draftRequiredDocumentEntry = z.object({
	key: z.string().regex(/^[a-z0-9_]{1,60}$/),
	label: z.string().trim().min(1).max(160),
	reusable: z.boolean(),
	sourceUrl: z.string().trim().url().max(500).nullable().optional(),
});

const draftInspectionEntry = z.object({
	name: z.string().trim().min(1).max(120),
	when: z.string().trim().max(300).nullable().optional(),
	criticalNote: z.string().trim().max(300).nullable().optional(),
});

export const draftPlaybookFacts = z.object({
	neededWhen: draftProvenanceFact.nullable().optional(),
	whoMayPull: draftProvenanceFact.nullable().optional(),
	prerequisites: z.array(draftProvenanceFact).max(20).optional(),
	howToApply: draftProvenanceFact.nullable().optional(),
	feeSchedule: draftProvenanceFact.nullable().optional(),
	typicalTurnaround: draftProvenanceFact.nullable().optional(),
	requiredDocuments: z.array(draftRequiredDocumentEntry).max(30).optional(),
	inspections: z.array(draftInspectionEntry).max(20).optional(),
});
export type DraftPlaybookFacts = z.infer<typeof draftPlaybookFacts>;

const jurisdictionKindEnum = z.enum(
	Object.values(JurisdictionKind) as [JurisdictionKind, ...JurisdictionKind[]],
);

const permitTypeEnum = z.enum(
	Object.values(PermitType) as [PermitType, ...PermitType[]],
);

export const jurisdictionInput = z.object({
	name: z.string().trim().min(1).max(160),
	kind: jurisdictionKindEnum,
	state: z.string().trim().min(2).max(2),
});
export type JurisdictionInput = z.infer<typeof jurisdictionInput>;

export { permitTypeEnum };

export function missingSourcePaths(draft: DraftPlaybookFacts): string[] {
	const missing: string[] = [];

	const singles: [string, DraftProvenanceFact | null | undefined][] = [
		["neededWhen", draft.neededWhen],
		["whoMayPull", draft.whoMayPull],
		["howToApply", draft.howToApply],
		["feeSchedule", draft.feeSchedule],
		["typicalTurnaround", draft.typicalTurnaround],
	];

	for (const [path, fact] of singles) {
		if (fact && !fact.sourceUrl) missing.push(path);
	}

	(draft.prerequisites ?? []).forEach((fact, index) => {
		if (!fact.sourceUrl) missing.push(`prerequisites[${index}]`);
	});

	(draft.requiredDocuments ?? []).forEach((doc, index) => {
		if (!doc.sourceUrl) missing.push(`requiredDocuments[${index}]`);
	});

	return missing;
}

function toProvenanceFact(
	fact: DraftProvenanceFact | null | undefined,
): ProvenanceFact | null {
	if (!fact) return null;
	return {
		value: fact.value,
		sourceUrl: fact.sourceUrl ?? null,
		verifiedById: null,
		verifiedAt: null,
	};
}

function draftToPlaybookFacts(draft: DraftPlaybookFacts): PlaybookFacts {
	return {
		neededWhen: toProvenanceFact(draft.neededWhen),
		whoMayPull: toProvenanceFact(draft.whoMayPull),
		prerequisites: (draft.prerequisites ?? [])
			.map(toProvenanceFact)
			.filter((fact): fact is ProvenanceFact => fact !== null),
		howToApply: toProvenanceFact(draft.howToApply),
		feeSchedule: toProvenanceFact(draft.feeSchedule),
		typicalTurnaround: toProvenanceFact(draft.typicalTurnaround),
		requiredDocuments: (draft.requiredDocuments ?? []).map((doc) => ({
			key: doc.key,
			label: doc.label,
			reusable: doc.reusable,
			sourceUrl: doc.sourceUrl ?? null,
			lockerKind: null,
			verifiedById: null,
			verifiedAt: null,
		})),
		inspections: (draft.inspections ?? []).map((inspection) => ({
			name: inspection.name,
			when: inspection.when ?? null,
			criticalNote: inspection.criticalNote ?? null,
			verifiedById: null,
			verifiedAt: null,
		})),
	};
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

async function findOrCreateJurisdiction(
	input: JurisdictionInput,
): Promise<{ id: string }> {
	const matchKey = buildJurisdictionMatchKey(
		input.state,
		input.kind,
		input.name,
	);

	const existing = await db.jurisdiction.findUnique({
		where: { matchKey },
		select: { id: true },
	});
	if (existing) return existing;

	try {
		return await db.jurisdiction.create({
			data: {
				name: input.name,
				kind: input.kind,
				state: input.state,
				matchKey,
			},
			select: { id: true },
		});
	} catch (error) {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			return db.jurisdiction.findUniqueOrThrow({
				where: { matchKey },
				select: { id: true },
			});
		}
		throw error;
	}
}

async function findOrCreatePlaybook(input: {
	jurisdictionId: string;
	permitType: PermitType;
	typeLabel: string;
}): Promise<{ id: string; facts: unknown }> {
	const existing = await db.permitPlaybook.findUnique({
		where: {
			jurisdictionId_permitType_typeLabel: {
				jurisdictionId: input.jurisdictionId,
				permitType: input.permitType,
				typeLabel: input.typeLabel,
			},
		},
		select: { id: true, facts: true },
	});
	if (existing) return existing;

	try {
		return await db.permitPlaybook.create({
			data: {
				jurisdictionId: input.jurisdictionId,
				permitType: input.permitType,
				typeLabel: input.typeLabel,
			},
			select: { id: true, facts: true },
		});
	} catch (error) {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			return db.permitPlaybook.findUniqueOrThrow({
				where: {
					jurisdictionId_permitType_typeLabel: {
						jurisdictionId: input.jurisdictionId,
						permitType: input.permitType,
						typeLabel: input.typeLabel,
					},
				},
				select: { id: true, facts: true },
			});
		}
		throw error;
	}
}

export type WritePlaybookDraftInput = {
	jurisdiction: JurisdictionInput;
	permitType: PermitType;
	typeLabel?: string;
	facts: DraftPlaybookFacts;
};

export type WritePlaybookDraftResult =
	| {
			written: true;
			playbookId: string;
			jurisdictionId: string;
	  }
	| {
			written: false;
			reason: string;
			missingSourceFor?: string[];
	  };

export async function writePlaybookDraft(
	input: WritePlaybookDraftInput,
): Promise<WritePlaybookDraftResult> {
	const missing = missingSourcePaths(input.facts);
	if (missing.length > 0) {
		return {
			written: false,
			reason:
				"Every draft fact needs the official source page it came from. " +
				`Missing a sourceUrl for: ${missing.join(", ")}.`,
			missingSourceFor: missing,
		};
	}

	const jurisdiction = await findOrCreateJurisdiction(input.jurisdiction);
	const typeLabel = input.typeLabel ?? "";
	const playbook = await findOrCreatePlaybook({
		jurisdictionId: jurisdiction.id,
		permitType: input.permitType,
		typeLabel,
	});

	await db.$transaction(async (tx) => {
		await tx.$queryRaw`
			SELECT id FROM "permit_playbook" WHERE id = ${playbook.id} FOR UPDATE
		`;
		const current = await tx.permitPlaybook.findUniqueOrThrow({
			where: { id: playbook.id },
			select: { facts: true },
		});
		const existingFacts = parsePlaybookFacts(current.facts);
		const draftFacts = draftToPlaybookFacts(input.facts);
		const merged = mergeDraftFacts(existingFacts, draftFacts);

		await tx.permitPlaybook.update({
			where: { id: playbook.id },
			data: { facts: factsToJson(merged) },
		});
	});

	return {
		written: true,
		playbookId: playbook.id,
		jurisdictionId: jurisdiction.id,
	};
}

export type FencedFact = {
	value: string;
	sourceUrl: string | null;
	verified: boolean;
} | null;

function fenceFact(label: string, fact: ProvenanceFact | null): FencedFact {
	if (!fact) return null;
	return {
		value: fenceUntrusted(label, fact.value),
		sourceUrl: fact.sourceUrl
			? fenceUntrusted(`${label} source`, fact.sourceUrl)
			: null,
		verified: fact.verifiedById !== null,
	};
}

export type PlaybookSummary = {
	found: true;
	jurisdictionId: string;
	playbookId: string;
	facts: {
		neededWhen: FencedFact;
		whoMayPull: FencedFact;
		prerequisites: FencedFact[];
		howToApply: FencedFact;
		feeSchedule: FencedFact;
		typicalTurnaround: FencedFact;
		requiredDocuments: {
			key: string;
			label: string;
			reusable: boolean;
			sourceUrl: string | null;
		}[];
		inspections: {
			name: string;
			when: string | null;
			criticalNote: string | null;
		}[];
	};
	worksheetTemplate: WorksheetField[];
};

export type PlaybookSummaryMiss = {
	found: false;
	jurisdictionId?: string;
	reason: string;
};

export async function loadPlaybookSummary(input: {
	jurisdiction: JurisdictionInput;
	permitType: PermitType;
	typeLabel?: string;
}): Promise<PlaybookSummary | PlaybookSummaryMiss> {
	const matchKey = buildJurisdictionMatchKey(
		input.jurisdiction.state,
		input.jurisdiction.kind,
		input.jurisdiction.name,
	);

	const jurisdiction = await db.jurisdiction.findUnique({
		where: { matchKey },
		select: { id: true },
	});
	if (!jurisdiction) {
		return {
			found: false,
			reason:
				"No jurisdiction on record with this name, kind and state yet. Nothing has been researched for it.",
		};
	}

	const typeLabel = input.typeLabel ?? "";
	const playbook = await db.permitPlaybook.findUnique({
		where: {
			jurisdictionId_permitType_typeLabel: {
				jurisdictionId: jurisdiction.id,
				permitType: input.permitType,
				typeLabel,
			},
		},
		select: { id: true, facts: true, worksheetTemplate: true },
	});
	if (!playbook) {
		return {
			found: false,
			jurisdictionId: jurisdiction.id,
			reason:
				"The jurisdiction exists, but no playbook has been started yet for this permit type.",
		};
	}

	const facts = parsePlaybookFacts(playbook.facts);
	const template = parseWorksheetTemplate(playbook.worksheetTemplate);

	return {
		found: true,
		jurisdictionId: jurisdiction.id,
		playbookId: playbook.id,
		facts: {
			neededWhen: fenceFact("needed when", facts.neededWhen),
			whoMayPull: fenceFact("who may pull", facts.whoMayPull),
			prerequisites: facts.prerequisites.map((fact) =>
				fenceFact("prerequisite", fact),
			),
			howToApply: fenceFact("how to apply", facts.howToApply),
			feeSchedule: fenceFact("fee schedule", facts.feeSchedule),
			typicalTurnaround: fenceFact(
				"typical turnaround",
				facts.typicalTurnaround,
			),
			requiredDocuments: facts.requiredDocuments.map((doc) => ({
				key: doc.key,
				label: fenceUntrusted("required document label", doc.label),
				reusable: doc.reusable,
				sourceUrl: doc.sourceUrl
					? fenceUntrusted("required document source", doc.sourceUrl)
					: null,
			})),
			inspections: facts.inspections.map((inspection) => ({
				name: fenceUntrusted("inspection name", inspection.name),
				when: inspection.when
					? fenceUntrusted("inspection timing", inspection.when)
					: null,
				criticalNote: inspection.criticalNote
					? fenceUntrusted("inspection note", inspection.criticalNote)
					: null,
			})),
		},
		worksheetTemplate: template,
	};
}

export type PermitSummary = {
	found: true;
	permit: {
		id: string;
		status: string;
		permitType: string;
		typeLabel: string;
		permitNumber: string | null;
		feeCents: number | null;
		submittedAt: string | null;
		issuedAt: string | null;
		expiresAt: string | null;
		closedAt: string | null;
		deniedReason: string | null;
	};
	deal: { id: string; name: string };
	jurisdiction: { id: string; name: string; kind: string; state: string };
	worksheetAnswers: Record<
		string,
		{ value: string; origin: string; state: string }
	>;
	checklist: {
		slotKey: string;
		label: string;
		filePath: string | null;
		lockerDocumentId: string | null;
		attachedAt: string | null;
	}[];
	inspections: {
		id: string;
		name: string;
		scheduledFor: string | null;
		result: string;
		note: string | null;
	}[];
};

export type PermitSummaryMiss = { found: false; reason: string };

export async function loadPermitSummary(
	permitId: string,
): Promise<PermitSummary | PermitSummaryMiss> {
	const permit = await db.permit.findUnique({
		where: { id: permitId },
		include: {
			deal: { select: { id: true, name: true } },
			jurisdiction: {
				select: { id: true, name: true, kind: true, state: true },
			},
			documents: { orderBy: { sortOrder: "asc" } },
			inspections: { orderBy: { sortOrder: "asc" } },
		},
	});
	if (!permit) return { found: false, reason: "No such permit." };

	const answers = parseWorksheetAnswers(permit.worksheetAnswers);
	const fencedAnswers: PermitSummary["worksheetAnswers"] = {};
	for (const [key, answer] of Object.entries(answers)) {
		fencedAnswers[key] = {
			value: fenceUntrusted(`worksheet answer ${key}`, answer.value),
			origin: answer.origin,
			state: answer.state,
		};
	}

	return {
		found: true,
		permit: {
			id: permit.id,
			status: permit.status,
			permitType: permit.permitType,
			typeLabel: permit.typeLabel,
			permitNumber: permit.permitNumber,
			feeCents: permit.feeCents,
			submittedAt: permit.submittedAt?.toISOString() ?? null,
			issuedAt: permit.issuedAt?.toISOString() ?? null,
			expiresAt: permit.expiresAt?.toISOString() ?? null,
			closedAt: permit.closedAt?.toISOString() ?? null,
			deniedReason: permit.deniedReason
				? fenceUntrusted("denied reason", permit.deniedReason)
				: null,
		},
		deal: {
			id: permit.deal.id,
			name: fenceUntrusted("deal name", permit.deal.name),
		},
		jurisdiction: {
			id: permit.jurisdiction.id,
			name: fenceUntrusted("jurisdiction name", permit.jurisdiction.name),
			kind: permit.jurisdiction.kind,
			state: permit.jurisdiction.state,
		},
		worksheetAnswers: fencedAnswers,
		checklist: permit.documents.map((doc) => ({
			slotKey: doc.slotKey,
			label: fenceUntrusted("checklist item label", doc.label),
			filePath: doc.filePath,
			lockerDocumentId: doc.lockerDocumentId,
			attachedAt: doc.attachedAt?.toISOString() ?? null,
		})),
		inspections: permit.inspections.map((inspection) => ({
			id: inspection.id,
			name: fenceUntrusted("inspection name", inspection.name),
			scheduledFor: inspection.scheduledFor?.toISOString() ?? null,
			result: inspection.result,
			note: inspection.note
				? fenceUntrusted("inspection note", inspection.note)
				: null,
		})),
	};
}
