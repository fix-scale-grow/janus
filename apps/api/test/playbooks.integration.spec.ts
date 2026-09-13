import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import type { PlaybookFacts } from "@crm/db/permits";
import { BadRequestException } from "@nestjs/common";
import { PermitPrefillService } from "../src/permits/permit-prefill.service";
import { PermitsService } from "../src/permits/permits.service";
import { PlaybooksService } from "../src/permits/playbooks.service";

const suffix = process.env.TEST_RUN_ID ?? "playbooks-spec";

const playbooks = new PlaybooksService(db);
const permits = new PermitsService(db, playbooks, new PermitPrefillService(db));

let userId: string;
const jurisdictionIds: string[] = [];

function emptyFacts(): PlaybookFacts {
	return {
		neededWhen: null,
		whoMayPull: null,
		prerequisites: [],
		howToApply: null,
		feeSchedule: null,
		typicalTurnaround: null,
		requiredDocuments: [],
		inspections: [],
	};
}

beforeAll(async () => {
	const user = await db.user.create({
		data: {
			id: `user-${suffix}`,
			name: "Test Rep",
			email: `rep-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;
});

afterAll(async () => {
	await db.permitPlaybook.deleteMany({
		where: { jurisdictionId: { in: jurisdictionIds } },
	});
	await db.jurisdiction.deleteMany({ where: { id: { in: jurisdictionIds } } });
	await db.user.deleteMany({ where: { id: userId } });
});

async function makeJurisdiction(name: string) {
	const jurisdiction = await permits.resolveJurisdiction({
		name,
		kind: "CITY",
		state: "CO",
	});
	jurisdictionIds.push(jurisdiction.id);
	return jurisdiction;
}

describe("PermitsService.resolveJurisdiction", () => {
	it("is idempotent for the same name, kind and state", async () => {
		const first = await permits.resolveJurisdiction({
			name: `  Denver  ${suffix}`,
			kind: "CITY",
			state: "CO",
		});
		jurisdictionIds.push(first.id);
		const second = await permits.resolveJurisdiction({
			name: `denver  ${suffix}`,
			kind: "CITY",
			state: "co",
		});

		expect(second.id).toBe(first.id);

		const count = await db.jurisdiction.count({
			where: { matchKey: first.matchKey },
		});
		expect(count).toBe(1);
	});
});

describe("PlaybooksService facts", () => {
	it("writes a set fact as unverified", async () => {
		const jurisdiction = await makeJurisdiction(`Aurora ${suffix}`);
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "ROOFING",
		});

		const updated = await playbooks.setFact({
			playbookId: playbook.id,
			factPath: "neededWhen",
			value: "Before tear-off begins",
			sourceUrl: null,
		});

		expect(updated.facts.neededWhen?.value).toBe("Before tear-off begins");
		expect(updated.facts.neededWhen?.verifiedById).toBeNull();
		expect(updated.facts.neededWhen?.verifiedAt).toBeNull();
	});

	it("stamps the acting user and time on verify", async () => {
		const jurisdiction = await makeJurisdiction(`Boulder ${suffix}`);
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "ROOFING",
		});

		await playbooks.setFact({
			playbookId: playbook.id,
			factPath: "whoMayPull",
			value: "Licensed contractor only",
			sourceUrl: null,
		});

		const verified = await playbooks.verifyFact(
			{ playbookId: playbook.id, factPath: "whoMayPull" },
			userId,
		);

		expect(verified.facts.whoMayPull?.verifiedById).toBe(userId);
		expect(verified.facts.whoMayPull?.verifiedAt).toBeInstanceOf(Date);
	});

	it("resets verification when a verified fact is edited", async () => {
		const jurisdiction = await makeJurisdiction(`Lakewood ${suffix}`);
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "ROOFING",
		});

		await playbooks.setFact({
			playbookId: playbook.id,
			factPath: "howToApply",
			value: "Apply online",
			sourceUrl: null,
		});
		await playbooks.verifyFact(
			{ playbookId: playbook.id, factPath: "howToApply" },
			userId,
		);

		const edited = await playbooks.setFact({
			playbookId: playbook.id,
			factPath: "howToApply",
			value: "Apply in person",
			sourceUrl: null,
		});

		expect(edited.facts.howToApply?.value).toBe("Apply in person");
		expect(edited.facts.howToApply?.verifiedById).toBeNull();
		expect(edited.facts.howToApply?.verifiedAt).toBeNull();
	});

	it("upsertDraftFacts never touches a verified fact and forces drafts unverified", async () => {
		const jurisdiction = await makeJurisdiction(`Golden ${suffix}`);
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "ROOFING",
		});

		await playbooks.setFact({
			playbookId: playbook.id,
			factPath: "feeSchedule",
			value: "Human-verified fee",
			sourceUrl: null,
		});
		await playbooks.verifyFact(
			{ playbookId: playbook.id, factPath: "feeSchedule" },
			userId,
		);

		const draft = emptyFacts();
		draft.feeSchedule = {
			value: "Agent-guessed fee",
			sourceUrl: "https://example.test/fees",
			verifiedById: "someone-else",
			verifiedAt: new Date(),
		};
		draft.typicalTurnaround = {
			value: "10 business days",
			sourceUrl: null,
			verifiedById: "someone-else",
			verifiedAt: new Date(),
		};

		const merged = await playbooks.upsertDraftFacts(playbook.id, draft);

		expect(merged.facts.feeSchedule?.value).toBe("Human-verified fee");
		expect(merged.facts.feeSchedule?.verifiedById).toBe(userId);
		expect(merged.facts.typicalTurnaround?.value).toBe("10 business days");
		expect(merged.facts.typicalTurnaround?.verifiedById).toBeNull();
		expect(merged.facts.typicalTurnaround?.verifiedAt).toBeNull();
	});

	it("replaces requiredDocuments from a draft only when currently empty", async () => {
		const jurisdiction = await makeJurisdiction(`Littleton ${suffix}`);
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "ROOFING",
		});

		const firstDraft = emptyFacts();
		firstDraft.requiredDocuments = [
			{ key: "site_plan", label: "Site plan", reusable: true, sourceUrl: null },
		];
		const afterFirst = await playbooks.upsertDraftFacts(
			playbook.id,
			firstDraft,
		);
		expect(afterFirst.facts.requiredDocuments).toHaveLength(1);

		const secondDraft = emptyFacts();
		secondDraft.requiredDocuments = [
			{
				key: "elevations",
				label: "Elevations",
				reusable: true,
				sourceUrl: null,
			},
			{
				key: "survey",
				label: "Survey",
				reusable: false,
				sourceUrl: null,
			},
		];
		const afterSecond = await playbooks.upsertDraftFacts(
			playbook.id,
			secondDraft,
		);

		expect(afterSecond.facts.requiredDocuments).toHaveLength(1);
		expect(afterSecond.facts.requiredDocuments[0]?.key).toBe("site_plan");
	});

	it("400s a worksheet template with a duplicate field key", async () => {
		const jurisdiction = await makeJurisdiction(`Englewood ${suffix}`);
		const playbook = await playbooks.findOrCreate({
			jurisdictionId: jurisdiction.id,
			permitType: "ROOFING",
		});

		try {
			await playbooks.setWorksheetTemplate({
				playbookId: playbook.id,
				fields: [
					{
						key: "job_number",
						label: "Job number",
						type: "TEXT",
						prefill: null,
						required: true,
					},
					{
						key: "job_number",
						label: "Job number again",
						type: "TEXT",
						prefill: null,
						required: false,
					},
				],
			} as never);
			expect.unreachable("setWorksheetTemplate accepted duplicate keys");
		} catch (error) {
			expect(error).toBeInstanceOf(BadRequestException);
		}
	});
});
