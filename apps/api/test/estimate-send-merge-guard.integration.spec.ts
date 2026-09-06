import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@crm/db";
import { BadRequestException } from "@nestjs/common";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { ContactsService } from "../src/contacts/contacts.service";
import { EstimatesService } from "../src/estimates/estimates.service";
import { FieldsService } from "../src/fields/fields.service";
import { MailerService } from "../src/mailer/mailer.service";
import { MergeContextService } from "../src/templates/merge-context.service";
import { TemplatesService } from "../src/templates/templates.service";

const suffix = process.env.TEST_RUN_ID ?? "estimate-send-merge-guard-spec";
const keySuffix = suffix.replace(/[^A-Za-z0-9_]/g, "_");
const domain = `merge-guard-${suffix}.test`;
const fieldKey = `guard_note_${keySuffix}`;
const fieldLabel = `Guard note ${suffix}`;
const userId = `merge-guard-user-${suffix}`;

const agent = {
	fieldBackfill: async () => undefined,
} as unknown as AgentTriggerService;

const fields = new FieldsService(db, agent);
const mergeContext = new MergeContextService(db);
const noContacts = {} as unknown as ContactsService;

let outboxDir: string;
let contactId: string;
let estimateId: string;

async function clean() {
	await db.estimate.deleteMany({ where: { createdById: userId } });
	await db.fieldValue.deleteMany({
		where: { contact: { email: { endsWith: domain } } },
	});
	await db.fieldDefinition.deleteMany({
		where: { entity: "CONTACT", key: fieldKey },
	});
	await db.contact.deleteMany({ where: { email: { endsWith: domain } } });
	await db.user.deleteMany({ where: { id: userId } });
	await db.template.deleteMany({ where: { purpose: "ESTIMATE_SEND" } });
}

beforeAll(async () => {
	await clean();
	outboxDir = await mkdtemp(join(tmpdir(), "merge-guard-outbox-"));

	await db.user.create({
		data: { id: userId, name: "Guard Tester", email: `${userId}@example.test` },
	});

	const contact = await db.contact.create({
		data: {
			firstName: "Merge",
			lastName: "Guard",
			email: `contact-${suffix}@${domain}`,
		},
		select: { id: true },
	});
	contactId = contact.id;

	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: fieldKey,
			label: fieldLabel,
			type: "TEXT",
			position: 950,
		},
	});

	const estimate = await db.estimate.create({
		data: {
			title: "Merge guard estimate",
			currency: "USD",
			selectedTier: "BETTER",
			contactId,
			createdById: userId,
			lineItems: {
				create: [
					{
						name: "Tear-off",
						unit: "PER_EACH",
						quantity: "1",
						priceGoodCents: 10000,
						priceBetterCents: 12000,
						priceBestCents: 15000,
					},
				],
			},
		},
		select: { id: true },
	});
	estimateId = estimate.id;

	await db.template.create({
		data: {
			purpose: "ESTIMATE_SEND",
			type: "EMAIL",
			name: "Estimate email",
			subject: "Your estimate from {{business.name}}",
			blocks: [
				{ kind: "heading", text: "Your estimate is ready" },
				{
					kind: "text",
					html: `Hi {{contact.first_name}}, note: {{contact.field.${fieldKey}}}`,
				},
			],
		},
	});
});

afterAll(async () => {
	await clean();
	await rm(outboxDir, { recursive: true, force: true });
});

function servicesFor(mailer: MailerService) {
	const templates = new TemplatesService(db, mergeContext, mailer, fields);
	const estimates = new EstimatesService(
		db,
		noContacts,
		mailer,
		templates,
		mergeContext,
		{} as AgentTriggerService,
	);
	return { estimates };
}

describe("EstimatesService.send merge guard", () => {
	it("blocks the send with the field's label when the value is empty", async () => {
		const mailer = new MailerService({
			transport: "file",
			outboxDir,
			from: "Janus <estimates@example.com>",
		});
		const { estimates } = servicesFor(mailer);

		let caught: unknown;
		try {
			await estimates.send({ id: estimateId });
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(BadRequestException);
		const message = (caught as BadRequestException).message;
		expect(message).toContain("Missing for this estimate");
		expect(message).toContain(fieldLabel);

		const entries = await readdir(outboxDir).catch(() => []);
		expect(entries).toHaveLength(0);
	});

	it("sends once the field is filled, with the value in the outbox HTML", async () => {
		await fields.applyValues(db, "CONTACT", contactId, {
			[fieldKey]: "Bring the ladder",
		});

		const mailer = new MailerService({
			transport: "file",
			outboxDir,
			from: "Janus <estimates@example.com>",
		});
		const { estimates } = servicesFor(mailer);

		const result = await estimates.send({ id: estimateId });
		expect(result.status).toBe("SENT");

		const entries = await readdir(outboxDir);
		expect(entries).toHaveLength(1);

		const sendDir = join(outboxDir, entries[0] ?? "");
		const envelopeRaw = await readFile(join(sendDir, "envelope.json"), "utf8");
		const envelope = JSON.parse(envelopeRaw) as { html: string | null };

		expect(envelope.html).toContain("Bring the ladder");
	});
});
