import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { FieldsService } from "../src/fields/fields.service";
import { MergeContextService } from "../src/templates/merge-context.service";

const suffix = process.env.TEST_RUN_ID ?? "field-merge-spec";
const domain = `merge-fields-${suffix}.test`;

const agent = {
	fieldBackfill: async () => undefined,
} as unknown as AgentTriggerService;

const fields = new FieldsService(db, agent);
const mergeContext = new MergeContextService(db);

const userId = `merge-user-${suffix}`;
const userName = `Casey Champion ${suffix}`;

const textKey = `merge_text_${suffix}`;
const numberKey = `merge_number_${suffix}`;
const dateKey = `merge_date_${suffix}`;
const checkboxKey = `merge_checkbox_${suffix}`;
const selectKey = `merge_select_${suffix}`;
const userKey = `merge_user_${suffix}`;
const emptyKey = `merge_empty_${suffix}`;
const archivedKey = `merge_archived_${suffix}`;
const dealTextKey = `merge_deal_text_${suffix}`;

const allKeys = [
	textKey,
	numberKey,
	dateKey,
	checkboxKey,
	selectKey,
	userKey,
	emptyKey,
	archivedKey,
	dealTextKey,
];

let contactId: string;
let dealId: string;

async function clean() {
	const contacts = await db.contact.findMany({
		where: { email: { endsWith: domain } },
		select: { id: true },
	});
	const contactIds = contacts.map((row) => row.id);

	await db.fieldValue.deleteMany({
		where: {
			OR: [{ contactId: { in: contactIds } }, { deal: { ownerId: userId } }],
		},
	});
	await db.fieldDefinition.deleteMany({ where: { key: { in: allKeys } } });
	await db.deal.deleteMany({ where: { ownerId: userId } });
	await db.contact.deleteMany({ where: { email: { endsWith: domain } } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();

	await db.user.create({
		data: { id: userId, name: userName, email: `${userId}@example.test` },
	});

	const contact = await db.contact.create({
		data: {
			firstName: "Merge",
			lastName: "Test",
			email: `contact-${suffix}@${domain}`,
		},
		select: { id: true },
	});
	contactId = contact.id;

	const deal = await db.deal.create({
		data: { name: `Merge deal ${suffix}`, ownerId: userId },
		select: { id: true },
	});
	dealId = deal.id;

	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: textKey,
			label: "Merge text",
			type: "TEXT",
			position: 900,
		},
	});
	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: numberKey,
			label: "Merge number",
			type: "NUMBER",
			position: 901,
		},
	});
	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: dateKey,
			label: "Merge date",
			type: "DATE",
			position: 902,
		},
	});
	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: checkboxKey,
			label: "Merge checkbox",
			type: "CHECKBOX",
			position: 903,
		},
	});
	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: selectKey,
			label: "Merge select",
			type: "SELECT",
			position: 904,
			options: {
				create: [
					{ label: "Asphalt Shingle", position: 0 },
					{ label: "Metal Panel", position: 1 },
				],
			},
		},
	});
	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: userKey,
			label: "Merge user",
			type: "USER",
			position: 905,
		},
	});
	await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: emptyKey,
			label: "Merge empty",
			type: "TEXT",
			position: 906,
		},
	});
	const archivedField = await db.fieldDefinition.create({
		data: {
			entity: "CONTACT",
			key: archivedKey,
			label: "Merge archived",
			type: "TEXT",
			position: 907,
		},
	});
	await db.fieldDefinition.create({
		data: {
			entity: "DEAL",
			key: dealTextKey,
			label: "Merge deal text",
			type: "TEXT",
			position: 908,
		},
	});

	await fields.applyValues(db, "CONTACT", contactId, {
		[textKey]: "Shingle Roof",
		[numberKey]: "12.50",
		[dateKey]: "2026-09-06",
		[checkboxKey]: true,
		[selectKey]: "Metal Panel",
		[userKey]: userId,
		[archivedKey]: "Should not appear",
	});

	await fields.applyValues(db, "DEAL", dealId, {
		[dealTextKey]: "Ranch job",
	});

	await db.fieldDefinition.update({
		where: { id: archivedField.id },
		data: { archivedAt: new Date() },
	});
});

afterAll(clean);

describe("MergeContextService field pull-through", () => {
	it("formats each custom field type for display", async () => {
		const context = await mergeContext.resolve({ contactId, dealId });

		expect(context[`contact.field.${textKey}`]).toBe("Shingle Roof");
		expect(context[`contact.field.${numberKey}`]).toBe("12.5");
		expect(context[`contact.field.${dateKey}`]).toBe("Sep 6, 2026");
		expect(context[`contact.field.${checkboxKey}`]).toBe("Yes");
		expect(context[`contact.field.${selectKey}`]).toBe("Metal Panel");
		expect(context[`contact.field.${userKey}`]).toBe(userName);
		expect(context[`deal.field.${dealTextKey}`]).toBe("Ranch job");
	});

	it("emits no key for a field with no value", async () => {
		const context = await mergeContext.resolve({ contactId, dealId });

		expect(context[`contact.field.${emptyKey}`]).toBeUndefined();
	});

	it("emits no key for an archived definition, even with a value", async () => {
		const context = await mergeContext.resolve({ contactId, dealId });

		expect(context[`contact.field.${archivedKey}`]).toBeUndefined();
	});
});
