import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { contactCreateInput } from "../src/contacts/contacts.contracts";
import { ContactsService } from "../src/contacts/contacts.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "contacts-spec";
const domain = `contacts-${suffix}.test`;
const ours = { OR: [{ email: { endsWith: `@${domain}` } }] };

const agent = {
	contactCreated: async () => undefined,
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;

const stamp = new ActivityStampService(db);
const queue = new AgentQueueService(db);
const fields = new FieldsService(db, agent);
const contacts = new ContactsService(db, agent, queue, stamp, fields);

async function clean() {
	await db.contact.deleteMany({ where: ours });
}

beforeAll(clean);
afterAll(clean);

describe("a contact's company name", () => {
	it("is trimmed and stored on create, blank comes back null", async () => {
		const withName = await contacts.create({
			firstName: "Ada",
			email: `ada@${domain}`,
			companyName: "  Acme Roofing  ",
		});

		const stored = await contacts.byId(withName.id);
		expect(stored.companyName).toBe("Acme Roofing");

		const withoutName = await contacts.create({
			firstName: "Grace",
			email: `grace@${domain}`,
			companyName: "   ",
		});

		const storedWithout = await contacts.byId(withoutName.id);
		expect(storedWithout.companyName).toBeNull();
	});

	it("round-trips through an update, trimmed and blank-to-null", async () => {
		const created = await contacts.create({
			firstName: "Alan",
			email: `alan@${domain}`,
		});

		await contacts.update(created.id, { companyName: "  Turing Corp  " });

		const updated = await contacts.byId(created.id);
		expect(updated.companyName).toBe("Turing Corp");

		await contacts.update(created.id, { companyName: "" });

		const cleared = await contacts.byId(created.id);
		expect(cleared.companyName).toBeNull();
	});

	it("rejects a name longer than 200 characters", () => {
		const result = contactCreateInput.safeParse({
			firstName: "Too",
			companyName: "x".repeat(201),
		});

		expect(result.success).toBe(false);
	});
});
