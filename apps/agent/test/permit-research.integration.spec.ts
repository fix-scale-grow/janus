import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, PermitType, type Prisma } from "@crm/db";
import { parsePlaybookFacts } from "@crm/db/permits";
import {
	buildJurisdictionMatchKey,
	writePlaybookDraft,
} from "../agent/lib/permit-research";
import writePlaybookDraftTool from "../agent/tools/write_playbook_draft";
import { PERMIT_PLAYBOOK_OVERRIDE } from "./injection-fixtures";

const suffix = process.env.TEST_RUN_ID ?? "permit-research-spec";
const jurisdictionName = `Hostile County ${suffix}`;

function automatedSession() {
	return {
		auth: {
			current: {
				authenticator: "app",
				principalId: "eve:app",
				principalType: "runtime",
				attributes: {},
			},
			initiator: null,
		},
	};
}

async function cleanup(): Promise<void> {
	await db.jurisdiction.deleteMany({ where: { name: { contains: suffix } } });
}

beforeAll(cleanup);
afterAll(cleanup);

describe("write_playbook_draft tool", () => {
	it("refuses a fact with no sourceUrl before touching the database", async () => {
		const result = await writePlaybookDraftTool.execute(
			{
				jurisdiction: {
					name: `No Source City ${suffix}`,
					kind: "CITY",
					state: "CA",
				},
				permitType: "BUILDING",
				facts: {
					neededWhen: { value: "Before any exterior work begins." },
				},
			},
			{ session: automatedSession() } as never,
		);

		expect(result).toMatchObject({
			written: false,
			missingSourceFor: ["neededWhen"],
		});

		const matchKey = buildJurisdictionMatchKey(
			"CA",
			"CITY",
			`No Source City ${suffix}`,
		);
		const jurisdiction = await db.jurisdiction.findUnique({
			where: { matchKey },
		});
		expect(jurisdiction).toBeNull();
	});

	it("writes a sourced draft through to the database", async () => {
		const result = await writePlaybookDraftTool.execute(
			{
				jurisdiction: {
					name: `Sourced City ${suffix}`,
					kind: "CITY",
					state: "CA",
				},
				permitType: "BUILDING",
				facts: {
					neededWhen: {
						value: "Before any exterior work begins.",
						sourceUrl: "https://sourced-city.example.gov/permits",
					},
				},
			},
			{ session: automatedSession() } as never,
		);

		expect(result).toMatchObject({ written: true });
	});
});

describe("writePlaybookDraft merge invariants", () => {
	it("lands every draft fact unverified", async () => {
		const jurisdiction = {
			name: jurisdictionName,
			kind: "CITY" as const,
			state: "TX",
		};

		const result = await writePlaybookDraft({
			jurisdiction,
			permitType: PermitType.ROOFING,
			facts: {
				neededWhen: {
					value: PERMIT_PLAYBOOK_OVERRIDE,
					sourceUrl: "https://roof-city.example.gov/permits",
				},
				whoMayPull: {
					value: "Licensed contractor or homeowner.",
					sourceUrl: "https://roof-city.example.gov/permits",
				},
			},
		});
		if (!result.written) throw new Error("expected the draft to be written");

		const playbook = await db.permitPlaybook.findUniqueOrThrow({
			where: { id: result.playbookId },
		});
		const facts = parsePlaybookFacts(playbook.facts);

		expect(facts.neededWhen?.value).toBe(PERMIT_PLAYBOOK_OVERRIDE);
		expect(facts.neededWhen?.verifiedById).toBeNull();
		expect(facts.neededWhen?.verifiedAt).toBeNull();
		expect(facts.whoMayPull?.verifiedById).toBeNull();
	});

	it("never lets a draft overwrite a fact a person has verified", async () => {
		const matchKey = buildJurisdictionMatchKey("TX", "CITY", jurisdictionName);
		const jurisdiction = await db.jurisdiction.findUniqueOrThrow({
			where: { matchKey },
		});
		const playbook = await db.permitPlaybook.findUniqueOrThrow({
			where: {
				jurisdictionId_permitType_typeLabel: {
					jurisdictionId: jurisdiction.id,
					permitType: PermitType.ROOFING,
					typeLabel: "",
				},
			},
		});

		await db.permitPlaybook.update({
			where: { id: playbook.id },
			data: {
				facts: {
					...(playbook.facts as Prisma.JsonObject),
					howToApply: {
						value: "Apply in person at City Hall.",
						sourceUrl: "https://roof-city.example.gov/apply",
						verifiedById: "verifying-user",
						verifiedAt: new Date().toISOString(),
					},
				} as Prisma.InputJsonValue,
			},
		});

		const result = await writePlaybookDraft({
			jurisdiction: { name: jurisdictionName, kind: "CITY", state: "TX" },
			permitType: PermitType.ROOFING,
			facts: {
				howToApply: {
					value: "Apply online at the new portal.",
					sourceUrl: "https://roof-city.example.gov/new-portal",
				},
			},
		});
		if (!result.written) throw new Error("expected the draft to be written");

		const saved = await db.permitPlaybook.findUniqueOrThrow({
			where: { id: playbook.id },
		});
		const facts = parsePlaybookFacts(saved.facts);

		expect(facts.howToApply?.value).toBe("Apply in person at City Hall.");
		expect(facts.howToApply?.verifiedById).toBe("verifying-user");
	});

	it("replaces requiredDocuments and inspections only while they are still empty", async () => {
		const draftResult = await writePlaybookDraft({
			jurisdiction: { name: jurisdictionName, kind: "CITY", state: "TX" },
			permitType: PermitType.ELECTRICAL,
			facts: {
				requiredDocuments: [
					{
						key: "site_plan",
						label: "Site plan",
						reusable: false,
						sourceUrl: "https://roof-city.example.gov/electrical",
					},
				],
				inspections: [
					{
						name: "Rough-in inspection",
						when: "Before drywall",
						criticalNote: null,
					},
				],
			},
		});
		if (!draftResult.written)
			throw new Error("expected the draft to be written");

		const secondResult = await writePlaybookDraft({
			jurisdiction: { name: jurisdictionName, kind: "CITY", state: "TX" },
			permitType: PermitType.ELECTRICAL,
			facts: {
				requiredDocuments: [
					{
						key: "load_calc",
						label: "Load calculation",
						reusable: false,
						sourceUrl: "https://roof-city.example.gov/electrical",
					},
				],
				inspections: [
					{ name: "Final inspection", when: null, criticalNote: null },
				],
			},
		});
		if (!secondResult.written)
			throw new Error("expected the second draft to write");

		const playbook = await db.permitPlaybook.findUniqueOrThrow({
			where: { id: draftResult.playbookId },
		});
		const facts = parsePlaybookFacts(playbook.facts);

		expect(facts.requiredDocuments).toHaveLength(1);
		expect(facts.requiredDocuments[0]?.key).toBe("site_plan");
		expect(facts.inspections).toHaveLength(1);
		expect(facts.inspections[0]?.name).toBe("Rough-in inspection");
	});

	it("refuses when any fact in the batch is missing a sourceUrl", async () => {
		const result = await writePlaybookDraft({
			jurisdiction: { name: jurisdictionName, kind: "CITY", state: "TX" },
			permitType: PermitType.MECHANICAL,
			facts: {
				feeSchedule: { value: "$150 flat fee." },
			},
		});

		expect(result).toMatchObject({
			written: false,
			missingSourceFor: ["feeSchedule"],
		});

		const matchKey = buildJurisdictionMatchKey("TX", "CITY", jurisdictionName);
		const jurisdiction = await db.jurisdiction.findUnique({
			where: { matchKey },
		});
		const playbook = jurisdiction
			? await db.permitPlaybook.findUnique({
					where: {
						jurisdictionId_permitType_typeLabel: {
							jurisdictionId: jurisdiction.id,
							permitType: PermitType.MECHANICAL,
							typeLabel: "",
						},
					},
				})
			: null;
		expect(playbook).toBeNull();
	});
});
