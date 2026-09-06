import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { FieldsService } from "../src/fields/fields.service";
import type { MailerService } from "../src/mailer/mailer.service";
import type { MergeContextService } from "../src/templates/merge-context.service";
import { TemplatesService } from "../src/templates/templates.service";

const suffix = process.env.TEST_RUN_ID ?? "templates-merge-fields-spec";
const fieldKey = `roof_type_${suffix}`;

const agent = {
	fieldBackfill: async () => undefined,
} as unknown as AgentTriggerService;

const mergeContext = {
	resolve: async () => ({}),
} as unknown as MergeContextService;

const mailer = {
	isConfigured: () => false,
	send: async () => ({ delivered: false }),
} as unknown as MailerService;

const fields = new FieldsService(db, agent);
const templates = new TemplatesService(db, mergeContext, mailer, fields);

async function clean() {
	await db.fieldDefinition.deleteMany({
		where: { entity: "CONTACT", key: fieldKey },
	});
}

beforeAll(clean);
afterAll(clean);

describe("TemplatesService.mergeFields", () => {
	it("returns the static groups when there are no custom fields", async () => {
		const result = await templates.mergeFields();

		const contactGroup = result.groups.find((group) => group.id === "contact");
		expect(contactGroup?.fields).toContainEqual({
			token: "contact.full_name",
			label: "Full name",
		});
	});

	it("includes a custom contact field, then removes it once archived", async () => {
		const created = await db.fieldDefinition.create({
			data: {
				entity: "CONTACT",
				key: fieldKey,
				label: `Roof type ${suffix}`,
				type: "TEXT",
				position: 999,
			},
		});

		const withField = await templates.mergeFields();
		const contactFieldsGroup = withField.groups.find(
			(group) => group.id === "contact_fields",
		);

		expect(contactFieldsGroup?.label).toBe("Contact fields");
		expect(contactFieldsGroup?.fields).toContainEqual({
			token: `contact.field.${fieldKey}`,
			label: `Roof type ${suffix}`,
		});

		await db.fieldDefinition.update({
			where: { id: created.id },
			data: { archivedAt: new Date() },
		});

		const withoutField = await templates.mergeFields();
		const afterArchive = withoutField.groups.find(
			(group) => group.id === "contact_fields",
		);

		expect(
			afterArchive?.fields.some(
				(field) => field.token === `contact.field.${fieldKey}`,
			),
		).toBe(false);
	});
});
