import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db, EnrichmentStatus } from "@crm/db";
import { markRunning, settle } from "../agent/lib/enrichment";

async function clear() {
	await db.agentTask.deleteMany({ where: { reason: "lifecycle" } });
	await db.contact.deleteMany({
		where: { email: { startsWith: "lifecycle-" } },
	});
}

beforeEach(clear);
afterEach(clear);

async function contact() {
	return db.contact.create({
		data: {
			firstName: "Lifecycle",
			email: `lifecycle-${crypto.randomUUID()}@example.test`,
		},
		select: { id: true },
	});
}

function subjectOf(ids: { contactId?: string }) {
	return {
		id: "task",
		kind: "test",
		contactId: ids.contactId ?? null,
	};
}

async function retiredTask(contactId: string) {
	const row = await db.contact.findUniqueOrThrow({
		where: { id: contactId },
		select: { updatedAt: true },
	});

	return db.agentTask.create({
		data: {
			contactId,
			kind: "recheck",
			reason: "lifecycle",
			attempts: 3,
			dueAt: row.updatedAt,
			finishedAt: new Date(row.updatedAt.getTime() + 1),
		},
		select: { id: true },
	});
}

async function statusOfContact(id: string) {
	const row = await db.contact.findUnique({
		where: { id },
		select: { enrichmentStatus: true, enrichedAt: true },
	});
	return row;
}

describe("the record follows the task", () => {
	it("takes a contact off PENDING, which nothing used to do", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		expect((await statusOfContact(person.id))?.enrichmentStatus).toBe(
			"PENDING",
		);

		await markRunning(subject);
		expect((await statusOfContact(person.id))?.enrichmentStatus).toBe(
			"RUNNING",
		);

		await settle(subject, EnrichmentStatus.COMPLETE);
		const done = await statusOfContact(person.id);
		expect(done?.enrichmentStatus).toBe("COMPLETE");
		expect(done?.enrichedAt).not.toBeNull();
	});

	it("lets a tool's more specific answer win over the queue's", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		await markRunning(subject);

		await db.contact.update({
			where: { id: person.id },
			data: {
				enrichmentStatus: EnrichmentStatus.SKIPPED,
				enrichmentError: "No email to look up.",
			},
		});

		await settle(subject, EnrichmentStatus.COMPLETE);

		const row = await statusOfContact(person.id);
		expect(row?.enrichmentStatus).toBe("SKIPPED");
	});

	it("puts a failed record back to work on a retry", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		await markRunning(subject);
		await settle(subject, EnrichmentStatus.FAILED, "the vendor refused");
		expect((await statusOfContact(person.id))?.enrichmentStatus).toBe("FAILED");

		await markRunning(subject);
		const retried = await statusOfContact(person.id);
		expect(retried?.enrichmentStatus).toBe("RUNNING");

		const row = await db.contact.findUnique({
			where: { id: person.id },
			select: { enrichmentError: true },
		});
		expect(row?.enrichmentError).toBeNull();
	});

	it("records the failure of a task that was retired before it ran", async () => {
		const person = await contact();
		const task = await retiredTask(person.id);

		await settle(
			{ ...subjectOf({ contactId: person.id }), id: task.id },
			EnrichmentStatus.FAILED,
			"Research was attempted several times and never completed.",
		);

		const row = await statusOfContact(person.id);
		expect(row?.enrichmentStatus).toBe("FAILED");
	});

	it("leaves a fresh request alone when a retired task settles late", async () => {
		const person = await contact();
		const task = await retiredTask(person.id);

		await db.contact.update({
			where: { id: person.id },
			data: {
				enrichmentStatus: EnrichmentStatus.PENDING,
				enrichmentError: null,
			},
		});

		await settle(
			{ ...subjectOf({ contactId: person.id }), id: task.id },
			EnrichmentStatus.FAILED,
			"Research was attempted several times and never completed.",
		);

		const row = await db.contact.findUnique({
			where: { id: person.id },
			select: { enrichmentStatus: true, enrichmentError: true },
		});
		expect(row?.enrichmentStatus).toBe("PENDING");
		expect(row?.enrichmentError).toBeNull();
	});

	it("leaves a queued record alone when a task that never ended fails late", async () => {
		const person = await contact();
		const open = await db.agentTask.create({
			data: {
				contactId: person.id,
				kind: "recheck",
				reason: "lifecycle",
				dueAt: new Date(),
			},
			select: { id: true },
		});

		await db.contact.update({
			where: { id: person.id },
			data: {
				enrichmentStatus: EnrichmentStatus.PENDING,
				enrichmentError: null,
			},
		});

		await settle(
			{ ...subjectOf({ contactId: person.id }), id: open.id },
			EnrichmentStatus.FAILED,
			"The agent turn failed.",
		);

		const row = await db.contact.findUnique({
			where: { id: person.id },
			select: { enrichmentStatus: true, enrichmentError: true },
		});
		expect(row?.enrichmentStatus).toBe("PENDING");
		expect(row?.enrichmentError).toBeNull();
	});

	it("leaves the record to a newer request when an ended task settles late", async () => {
		const person = await contact();
		const task = await retiredTask(person.id);
		await db.agentTask.create({
			data: {
				contactId: person.id,
				kind: "recheck",
				reason: "lifecycle",
				dueAt: new Date(),
			},
			select: { id: true },
		});

		await settle(
			{ ...subjectOf({ contactId: person.id }), id: task.id },
			EnrichmentStatus.FAILED,
			"Research was attempted several times and never completed.",
		);

		const row = await db.contact.findUnique({
			where: { id: person.id },
			select: { enrichmentStatus: true, enrichmentError: true },
		});
		expect(row?.enrichmentStatus).toBe("PENDING");
		expect(row?.enrichmentError).toBeNull();
	});

	it("survives a record deleted while the agent was still reading about it", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		await markRunning(subject);
		await db.contact.delete({ where: { id: person.id } });

		await settle(subject, EnrichmentStatus.COMPLETE);
	});
});
