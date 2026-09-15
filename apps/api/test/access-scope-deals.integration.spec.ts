import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, ProductionStage } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import { type AccessPrincipal, noAccessPrincipal } from "@crm/db/access-policy";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
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

async function expectForbidden(run: () => Promise<unknown>) {
	try {
		await run();
		throw new Error("expected ForbiddenException");
	} catch (error) {
		expect(error).toBeInstanceOf(ForbiddenException);
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

	test("clerk cannot attach a contact outside their scope", async () => {
		await expectNotFound(() =>
			deals.attachContact(
				{ dealId: f.clerkDealId, contactId: f.otherContactId },
				f.clerk,
			),
		);
	});

	test("clerk's contact options exclude a contact outside their scope", async () => {
		const options = await deals.contactOptions(f.clerkDealId, f.clerk);
		expect(options.map((o) => o.id)).not.toContain(f.otherContactId);
	});

	test("OWN create forces ownerId to the caller", async () => {
		const created = await deals.create(
			{ name: `Clerk-forced ${suffix}`, ownerId: f.adminId },
			f.clerk,
		);
		const stored = await db.deal.findUniqueOrThrow({
			where: { id: created.id },
			select: { ownerId: true },
		});
		expect(stored.ownerId).toBe(f.clerkId);
		await db.deal.delete({ where: { id: created.id } });
	});

	test("clerk cannot reassign a deal's owner to someone else", async () => {
		await expectForbidden(() =>
			deals.update(f.clerkDealId, { ownerId: f.adminId }, f.clerk),
		);
	});

	describe("setProductionStage with only deals.markComplete", () => {
		const base = noAccessPrincipal(`field-${suffix}`);
		const markComplete: AccessPrincipal = {
			...base,
			scope: "ALL",
			policy: { ...base.policy, actions: ["deals.markComplete"] },
		};

		let wonDealId: string;

		beforeAll(async () => {
			const wonStage = await db.stage.findFirstOrThrow({
				where: { key: "CLOSED_WON" },
			});
			const won = await db.deal.create({
				data: {
					name: `Won ${suffix}`,
					ownerId: f.adminId,
					stageId: wonStage.id,
					productionStage: ProductionStage.SCHEDULED,
				},
				select: { id: true },
			});
			wonDealId = won.id;
		});

		afterAll(async () => {
			await db.deal.deleteMany({ where: { id: wonDealId } });
		});

		test("allowed to move to COMPLETE", async () => {
			const result = await deals.setProductionStage(
				{ id: wonDealId, stage: ProductionStage.COMPLETE },
				f.adminId,
				markComplete,
			);
			expect(result.productionStage).toBe(ProductionStage.COMPLETE);
		});

		test("refused for any other stage", async () => {
			await expectForbidden(() =>
				deals.setProductionStage(
					{ id: wonDealId, stage: ProductionStage.IN_PROGRESS },
					f.adminId,
					markComplete,
				),
			);
		});
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

	test("byId only shows deals within the caller's scope", async () => {
		await db.dealContact.create({
			data: { dealId: f.otherDealId, contactId: f.clerkContactId },
		});

		const seenByClerk = await contacts.byId(f.clerkContactId, f.clerk);
		expect(seenByClerk.deals.map((d) => d.id)).toEqual([f.clerkDealId]);

		const seenByAdmin = await contacts.byId(f.clerkContactId, f.admin);
		expect(seenByAdmin.deals.map((d) => d.id)).toEqual(
			expect.arrayContaining([f.clerkDealId, f.otherDealId]),
		);

		await db.dealContact.deleteMany({
			where: { dealId: f.otherDealId, contactId: f.clerkContactId },
		});
	});

	test("OWN create forces ownerId to the caller", async () => {
		const created = await contacts.create(
			{ firstName: `Forced ${suffix}`, ownerId: f.adminId },
			f.clerk,
		);
		const stored = await db.contact.findUniqueOrThrow({
			where: { id: created.id },
			select: { ownerId: true },
		});
		expect(stored.ownerId).toBe(f.clerkId);
		await db.contact.delete({ where: { id: created.id } });
	});

	test("clerk cannot reassign a contact's owner to someone else", async () => {
		await expectForbidden(() =>
			contacts.update(f.clerkContactId, { ownerId: f.adminId }, f.clerk),
		);
	});

	test("clerk cannot reassign a contact's owner to no one", async () => {
		await expectForbidden(() =>
			contacts.update(f.clerkContactId, { ownerId: null }, f.clerk),
		);
	});

	test("bulk assign owner refuses a scoped user reassigning to someone else", async () => {
		await expectForbidden(() =>
			contacts.bulkAssignOwner(
				{ ids: [f.clerkContactId], ownerId: f.adminId },
				f.clerk,
			),
		);
	});

	test("bulk delete reports an out-of-scope contact as failed, not a whole-batch refusal", async () => {
		const created = await contacts.create(
			{ firstName: `Bulk ${suffix}`, ownerId: f.clerkId },
			f.admin,
		);
		await db.dealContact.create({
			data: { dealId: f.clerkDealId, contactId: created.id },
		});

		const result = await contacts.bulkDelete(
			[created.id, f.otherContactId],
			f.clerk,
		);
		expect(result.succeeded).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.message).toMatch(/No contact with id/);
	});
});
