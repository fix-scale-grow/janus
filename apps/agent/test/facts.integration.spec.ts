import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import type { Evidence } from "../agent/lib/evidence";
import { recordFact, writeBrief } from "../agent/lib/facts";

const suffix = process.env.TEST_RUN_ID ?? "facts-spec";
const email = `evidence.subject.${suffix}@example.test`;
const secondEmail = `evidence.typed.${suffix}@example.test`;

let contactId: string;
let typedContactId: string;

const seen = (kind: Evidence["kind"], detail = "observed"): Evidence => ({
	kind,
	detail,
});

beforeAll(async () => {
	await db.contact.deleteMany({
		where: { email: { in: [email, secondEmail] } },
	});
	const contact = await db.contact.create({
		data: { firstName: "Subject", lastName: null, email },
		select: { id: true },
	});
	contactId = contact.id;
	const typedContact = await db.contact.create({
		data: {
			firstName: "Typed",
			lastName: null,
			email: secondEmail,
			title: "Human-typed Title",
		},
		select: { id: true },
	});
	typedContactId = typedContact.id;
});

afterAll(async () => {
	await db.contact.deleteMany({
		where: { email: { in: [email, secondEmail] } },
	});
});

describe("recordFact", () => {
	it("writes a verified fact through to the record", async () => {
		const result = await recordFact({
			contactId,
			field: "title",
			value: "Head of Security",
			evidence: [seen("crm.thread-reply"), seen("crm.signature-block")],
			method: "crm.thread",
		});

		expect(result.applied).toBe(true);
		expect(result.band).toBe("VERIFIED");

		const contact = await db.contact.findUnique({
			where: { id: contactId },
			select: { title: true },
		});
		expect(contact?.title).toBe("Head of Security");
	});

	it("fills an empty field without asking anybody", async () => {
		const result = await recordFact({
			contactId,
			field: "seniority",
			value: "Director",
			evidence: [seen("web.cited-claim"), seen("web.cited-claim")],
			method: "web",
		});

		expect(result.applied).toBe(true);
		expect(result.band).toBe("PROBABLE");

		const fact = await db.contactFact.findFirst({
			where: { contactId, field: "seniority", status: "APPLIED" },
			select: { value: true },
		});
		expect(fact?.value).toBe("Director");
	});

	it("fills a field the record keeps no column for", async () => {
		const result = await recordFact({
			contactId,
			field: "location",
			value: "Brooklyn, NY",
			evidence: [seen("web.cited-claim")],
			method: "web",
		});

		expect(result.applied).toBe(true);
		expect(result.band).toBe("POSSIBLE");
	});

	it("offers rather than replaces a value it already found", async () => {
		const result = await recordFact({
			contactId,
			field: "seniority",
			value: "VP",
			evidence: [seen("web.cited-claim"), seen("web.cited-claim")],
			method: "web",
		});

		expect(result.stored).toBe(true);
		expect(result.applied).toBe(false);
		expect(result.reason).toContain("already carries a value");

		const fact = await db.contactFact.findFirst({
			where: { contactId, field: "seniority", status: "APPLIED" },
			select: { value: true },
		});
		expect(fact?.value).toBe("Director");
	});

	it("puts the same suggestion in front of a rep only once", async () => {
		const result = await recordFact({
			contactId,
			field: "seniority",
			value: "VP",
			evidence: [seen("web.cited-claim"), seen("web.cited-claim")],
			method: "web",
		});

		expect(result.stored).toBe(false);
		expect(result.reason).toContain("already in front of a rep");

		const offers = await db.contactFact.count({
			where: { contactId, field: "seniority", status: "PROPOSED" },
		});
		expect(offers).toBe(1);
	});

	it("settles the suggestions a stronger fact has answered", async () => {
		await recordFact({
			contactId,
			field: "seniority",
			value: "Chief of Staff",
			evidence: [seen("profile.email-match")],
			method: "web.profile",
		});

		const facts = await db.contactFact.findMany({
			where: { contactId, field: "seniority" },
			select: { value: true, status: true },
		});

		expect(facts.filter((fact) => fact.status === "PROPOSED")).toHaveLength(0);
		expect(facts.find((f) => f.value === "Chief of Staff")?.status).toBe(
			"APPLIED",
		);
	});

	it("never overwrites what a person typed", async () => {
		const result = await recordFact({
			contactId: typedContactId,
			field: "title",
			value: "Found on the web",
			evidence: [seen("crm.signature-block")],
			method: "crm.thread",
		});

		expect(result.applied).toBe(false);
		expect(result.reason).toContain("A person already filled in");

		const contact = await db.contact.findUnique({
			where: { id: typedContactId },
			select: { title: true },
		});
		expect(contact?.title).toBe("Human-typed Title");
	});

	it("never re-offers a value a person dismissed", async () => {
		const offer = await recordFact({
			contactId,
			field: "title",
			value: "Head of Trust",
			evidence: [seen("web.cited-claim"), seen("web.cited-claim")],
			method: "web",
		});
		expect(offer.applied).toBe(false);

		const proposal = await db.contactFact.findFirst({
			where: { contactId, field: "title", status: "PROPOSED" },
			select: { id: true },
		});
		await db.contactFact.update({
			where: { id: proposal?.id },
			data: { status: "DISMISSED", decidedAt: new Date() },
		});

		const result = await recordFact({
			contactId,
			field: "title",
			value: "Head of Trust",
			evidence: [seen("web.cited-claim"), seen("web.cited-claim")],
			method: "web",
		});

		expect(result.stored).toBe(false);
		expect(result.reason).toContain("dismissed");
	});

	it("supersedes rather than replaces, which is how a job change is noticed", async () => {
		await recordFact({
			contactId,
			field: "employer",
			value: "Fleetio",
			evidence: [seen("profile.email-match")],
			method: "web.profile",
		});

		await recordFact({
			contactId,
			field: "employer",
			value: "Comp AI",
			evidence: [seen("profile.email-match")],
			method: "web.profile",
		});

		const facts = await db.contactFact.findMany({
			where: { contactId, field: "employer" },
			select: { value: true, status: true },
		});

		expect(facts).toHaveLength(2);
		expect(facts.find((f) => f.value === "Fleetio")?.status).toBe("SUPERSEDED");
		expect(facts.find((f) => f.value === "Comp AI")?.status).toBe("APPLIED");
	});

	it("lets verified evidence settle the suggestion it matches", async () => {
		const offer = await recordFact({
			contactId,
			field: "employer",
			value: "Fleetio Inc",
			evidence: [seen("web.cited-claim"), seen("web.cited-claim")],
			method: "web",
		});
		expect(offer.applied).toBe(false);

		const result = await recordFact({
			contactId,
			field: "employer",
			value: "Fleetio Inc",
			evidence: [seen("profile.email-match")],
			method: "web.profile",
		});

		expect(result.stored).toBe(true);
		expect(result.applied).toBe(true);

		const facts = await db.contactFact.findMany({
			where: { contactId, field: "employer" },
			select: { value: true, status: true, score: true },
		});

		const live = facts.filter((fact) => fact.status === "APPLIED");
		expect(live).toHaveLength(1);
		expect(live[0]?.value).toBe("Fleetio Inc");
		expect(facts.filter((fact) => fact.status === "PROPOSED")).toHaveLength(0);
	});

	it("stores the evidence, so the score can be explained later", async () => {
		const fact = await db.contactFact.findFirst({
			where: { contactId, field: "title" },
			select: { evidence: true, score: true, sourceUrl: true },
		});

		expect(Array.isArray(fact?.evidence)).toBe(true);
		expect(fact?.score).toBeGreaterThan(0.85);
	});
});

describe("writeBrief", () => {
	it("upserts the background panel", async () => {
		await writeBrief({
			contactId,
			narrative: "Subject is Head of Security at Example.",
			sections: { currentRole: "Head of Security · Example" },
			evidence: [seen("crm.signature-block")],
			sourceUrl: "https://example.test/subject",
		});

		await writeBrief({
			contactId,
			narrative: "Subject is now VP Security at Example.",
			sections: { currentRole: "VP Security · Example" },
			evidence: [seen("crm.signature-block")],
		});

		const brief = await db.contactBrief.findUnique({ where: { contactId } });
		expect(brief?.narrative).toBe("Subject is now VP Security at Example.");
	});

	it("refuses a brief nothing supports", async () => {
		const result = await writeBrief({
			contactId,
			narrative: "Subject seems like a great person to know.",
			sections: {},
			evidence: [],
		});

		expect(result.written).toBe(false);
	});
});
