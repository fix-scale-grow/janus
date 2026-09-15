import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import fillWorksheetTool from "../agent/tools/fill_worksheet";

const suffix = process.env.TEST_RUN_ID ?? "fill-worksheet-spec";

let userId: string;
let dealId: string;
let jurisdictionId: string;
let playbookId: string;
let permitId: string;

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

function researchSession() {
	return {
		auth: {
			current: {
				authenticator: "better-auth",
				principalId: userId,
				principalType: "user",
				attributes: {},
			},
			initiator: null,
		},
	};
}

async function createPermit(): Promise<string> {
	const permit = await db.permit.create({
		data: {
			dealId,
			jurisdictionId,
			playbookId,
			permitType: "ROOFING",
			createdById: userId,
			worksheetAnswers: {},
		},
		select: { id: true },
	});
	return permit.id;
}

beforeAll(async () => {
	const user = await db.user.create({
		data: {
			id: `fill-worksheet-user-${suffix}`,
			name: "Fill Worksheet Rep",
			email: `fill-worksheet-rep-${suffix}@example.test`,
		},
		select: { id: true },
	});
	userId = user.id;
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: "Test",
			slug: `ws-${suffix}`,
			createdAt: new Date(),
		},
	});
	await db.member.create({
		data: {
			id: `fill-worksheet-member-${suffix}`,
			organizationId: WORKSPACE_ID,
			userId,
			role: "owner",
			createdAt: new Date(),
		},
	});

	const stage = await db.stage.findFirstOrThrow({
		where: { key: "DEMO_BOOKED" },
		select: { id: true },
	});

	const deal = await db.deal.create({
		data: {
			id: `fill-worksheet-deal-${suffix}`,
			name: `Fill Worksheet Deal ${suffix}`,
			ownerId: userId,
			stageId: stage.id,
		},
		select: { id: true },
	});
	dealId = deal.id;

	const jurisdiction = await db.jurisdiction.create({
		data: {
			name: `Fill Worksheet City ${suffix}`,
			kind: "CITY",
			state: "CO",
			matchKey: `co:city:fill worksheet city ${suffix}`,
		},
		select: { id: true },
	});
	jurisdictionId = jurisdiction.id;

	const playbook = await db.permitPlaybook.create({
		data: {
			jurisdictionId,
			permitType: "ROOFING",
			worksheetTemplate: [
				{
					key: "job_name",
					label: "Job name",
					type: "TEXT",
					prefill: "job_name",
					required: true,
				},
				{
					key: "owner_email",
					label: "Owner email",
					type: "TEXT",
					prefill: "owner_email",
					required: false,
				},
			],
		},
		select: { id: true },
	});
	playbookId = playbook.id;
});

afterAll(async () => {
	await db.permit.deleteMany({ where: { dealId } });
	await db.permitPlaybook.deleteMany({ where: { jurisdictionId } });
	await db.jurisdiction.deleteMany({ where: { id: jurisdictionId } });
	await db.deal.deleteMany({ where: { id: dealId } });
	await db.member.deleteMany({ where: { userId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("fill_worksheet tool", () => {
	it("denies an unattended (APP_AUTH) session before touching the database", async () => {
		const permitId = await createPermit();

		const denied = await fillWorksheetTool.approval({
			session: automatedSession(),
			toolName: "fill_worksheet",
			toolInput: { permitId, answers: { job_name: "Re-roof" } },
			approvedTools: [],
			callId: "call1",
		} as never);

		expect(denied).toMatchObject({
			type: "denied",
			reason: expect.stringContaining("Not something to do unattended"),
		});
	});

	it("writes NEEDS_REVIEW/AI answers with no approver in a conversational session", async () => {
		permitId = await createPermit();

		const result = await fillWorksheetTool.execute(
			{
				permitId,
				answers: { job_name: "Re-roof the main house", owner_email: "" },
			},
			{ session: researchSession() } as never,
		);

		expect(result).toMatchObject({
			applied: true,
			summary: "Filled 2 fields for review",
			filled: ["job_name", "owner_email"],
			skipped: [],
			permitId,
			dealId,
		});

		const permit = await db.permit.findUniqueOrThrow({
			where: { id: permitId },
		});
		const answers = permit.worksheetAnswers as Record<string, unknown>;
		expect(answers.job_name).toMatchObject({
			value: "Re-roof the main house",
			origin: "AI",
			state: "NEEDS_REVIEW",
			approvedById: null,
		});
	});

	it("never overwrites a field a person has already approved", async () => {
		const id = await createPermit();
		await db.permit.update({
			where: { id },
			data: {
				worksheetAnswers: {
					job_name: {
						value: "Approved by a human",
						origin: "HUMAN",
						state: "APPROVED",
						approvedById: userId,
						approvedAt: new Date().toISOString(),
					},
				},
			},
		});

		const result = await fillWorksheetTool.execute(
			{ permitId: id, answers: { job_name: "AI would overwrite this" } },
			{ session: researchSession() } as never,
		);

		expect(result).toMatchObject({
			applied: true,
			filled: [],
			skipped: [{ key: "job_name", reason: "Already approved by a person." }],
		});

		const permit = await db.permit.findUniqueOrThrow({ where: { id } });
		const answers = permit.worksheetAnswers as Record<string, unknown>;
		expect(answers.job_name).toMatchObject({
			value: "Approved by a human",
			state: "APPROVED",
			approvedById: userId,
		});
	});

	it("refuses a key that is not on the permit's live worksheet template", async () => {
		const id = await createPermit();

		const result = await fillWorksheetTool.execute(
			{ permitId: id, answers: { not_a_real_field: "sneaky" } },
			{ session: researchSession() } as never,
		);

		expect(result).toMatchObject({
			applied: true,
			filled: [],
			skipped: [
				{
					key: "not_a_real_field",
					reason: "Not a field on this permit's worksheet.",
				},
			],
		});

		const permit = await db.permit.findUniqueOrThrow({ where: { id } });
		expect(permit.worksheetAnswers).toEqual({});
	});
});
