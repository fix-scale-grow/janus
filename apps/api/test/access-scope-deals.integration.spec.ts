import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { NotFoundException } from "@nestjs/common";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { contactListInput } from "../src/contacts/contacts.contracts";
import { ContactsService } from "../src/contacts/contacts.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { dealListInput } from "../src/deals/deals.contracts";
import { DealsService } from "../src/deals/deals.service";
import { FieldsService } from "../src/fields/fields.service";
import type { PermitTriggerService } from "../src/permits/permit-trigger.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "scope-deals";

const agent = {
	contactCreated: async () => undefined,
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;

const stamp = new ActivityStampService(db);
const conversion = new ConversionService(db);
const fields = new FieldsService(db, {
	fieldBackfill: async () => undefined,
} as never);
const permitTrigger = {
	onStageChanged: async () => undefined,
} as unknown as PermitTriggerService;
const queue = new AgentQueueService(db);

const deals = new DealsService(
	db,
	agent,
	stamp,
	conversion,
	fields,
	permitTrigger,
);
const contacts = new ContactsService(db, agent, queue, stamp, fields);

const DEFAULT_DEAL_LIST_INPUT = dealListInput.parse({});
const DEFAULT_CONTACT_LIST_INPUT = contactListInput.parse({});

let f: AccessFixture;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
});

afterAll(async () => {
	await f.cleanup();
});

async function expectNotFound(run: () => Promise<unknown>) {
	try {
		await run();
		throw new Error("expected NotFoundException");
	} catch (error) {
		expect(error).toBeInstanceOf(NotFoundException);
	}
}

describe("deals scope", () => {
	test("clerk lists only their deal", async () => {
		const result = await deals.list(
			{ ...DEFAULT_DEAL_LIST_INPUT, q: "" },
			f.clerk,
		);
		const ids = result.rows.map((r) => r.id);
		expect(ids).toContain(f.clerkDealId);
		expect(ids).not.toContain(f.otherDealId);
	});

	test("office lists both", async () => {
		const ids = (await deals.list(DEFAULT_DEAL_LIST_INPUT, f.office)).rows.map(
			(r) => r.id,
		);
		expect(ids).toEqual(expect.arrayContaining([f.clerkDealId, f.otherDealId]));
	});

	test("clerk byId on another deal is not found", async () => {
		await expectNotFound(() => deals.byId(f.otherDealId, f.clerk));
	});

	test("clerk cannot update another deal", async () => {
		await expectNotFound(() =>
			deals.update(f.otherDealId, { name: "x" }, f.clerk),
		);
	});

	test("bulk delete skips out-of-scope ids", async () => {
		await expectNotFound(() => deals.bulkDelete([f.otherDealId], f.clerk));
	});
});

describe("contacts scope", () => {
	test("clerk sees contact on their deal only", async () => {
		const ids = (
			await contacts.list(DEFAULT_CONTACT_LIST_INPUT, f.clerk)
		).rows.map((r) => r.id);
		expect(ids).toContain(f.clerkContactId);
		expect(ids).not.toContain(f.otherContactId);
	});

	test("clerk byId on other contact is not found", async () => {
		await expectNotFound(() => contacts.byId(f.otherContactId, f.clerk));
	});
});
