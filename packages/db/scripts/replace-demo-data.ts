import { seedDemo, slug } from "../prisma/demo-data";
import { db } from "../src/client";
import { ActivityType } from "../src/generated/prisma/enums";

const CLEANUP = {
	allowedDatabases: ["janus_shakeup_dev", "crm"],
	legacyCompanies: [
		{ name: "Stripe", domain: "stripe.com", deals: 2 },
		{ name: "Linear", domain: "linear.app", deals: 1 },
		{ name: "Vercel", domain: "vercel.com", deals: 2 },
		{ name: "Ramp", domain: "ramp.com", deals: 1 },
		{ name: "Notion", domain: "notion.so", deals: 2 },
		{ name: "Monzo", domain: "monzo.com", deals: 1 },
		{ name: "Wise", domain: "wise.com", deals: 2 },
		{ name: "Personio", domain: "personio.com", deals: 1 },
		{ name: "Pennylane", domain: "pennylane.com", deals: 2 },
		{ name: "Cal.com", domain: "cal.com", deals: 1 },
		{ name: "Supabase", domain: "supabase.com", deals: 2 },
		{ name: "Retool", domain: "retool.com", deals: 1 },
		{ name: "Deel", domain: "deel.com", deals: 2 },
		{ name: "Mercury", domain: "mercury.com", deals: 1 },
		{ name: "Attio", domain: "attio.com", deals: 2 },
	],
	legacyNoteBodies: [
		"Ran through the SOC 2 timeline. They want evidence collection automated before the audit window opens.",
		"Procurement wants a security questionnaire back before they will look at pricing.",
		"Champion is keen, but the budget owner has not been in a call yet.",
		"They are evaluating us against two others. Differentiator is the agent, not the checklist.",
		"Asked for a reference in the same vertical. Following up with marketing.",
		"Pushed the decision to after their board meeting.",
	],
	legacyActivitySubjects: [
		"Discovery call",
		"Technical deep dive",
		"Pricing discussion",
		"Follow-up call",
		"Security review",
		"Send the security questionnaire",
		"Share pricing proposal",
		"Book the technical deep dive",
		"Chase procurement",
		"Send SOC 2 report",
		"Introduce the implementation team",
		"Product demo",
		"Onboarding walkthrough",
		"Quarterly check-in",
		"Stakeholder alignment",
		"Re: next steps",
		"Following up after the demo",
		"Pricing and terms",
		"Intro to your implementation lead",
	],
	legacyRateProvider: "seed",
	counted: [
		"deal",
		"contact",
		"dealContact",
		"activity",
		"exchangeRate",
		"estimate",
		"invoice",
		"drawing",
		"project",
		"contract",
		"permit",
		"photo",
		"jobCost",
		"formSubmission",
		"fieldValue",
		"agentConversation",
		"user",
		"member",
		"accessGroup",
		"service",
		"symbol",
		"template",
		"form",
	],
} as const;

type CountedTable = (typeof CLEANUP.counted)[number];

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const includeLinked = args.has("--include-linked");

function databaseName(url: string): string {
	try {
		return new URL(url).pathname.replace(/^\//, "");
	} catch {
		return "";
	}
}

const name = databaseName(process.env.DATABASE_URL ?? "");
const allowed: readonly string[] = CLEANUP.allowedDatabases;

if (!allowed.includes(name)) {
	console.error(
		`Refusing to run against "${name}". Allowed: ${CLEANUP.allowedDatabases.join(", ")}.`,
	);
	process.exit(1);
}

type Delegate = { count: (args?: object) => Promise<number> };

async function countAll(): Promise<Record<CountedTable, number>> {
	const entries = await Promise.all(
		CLEANUP.counted.map(async (table) => {
			const delegate = db[table] as unknown as Delegate;
			return [table, await delegate.count()] as const;
		}),
	);
	return Object.fromEntries(entries) as Record<CountedTable, number>;
}

function legacyDealIds(): string[] {
	return CLEANUP.legacyCompanies.flatMap((company) =>
		Array.from(
			{ length: company.deals },
			(_, n) => `seed-deal-${slug(company.name)}-${n}`,
		),
	);
}

async function findLegacyContacts() {
	const rows = await db.contact.findMany({
		where: {
			companyName: { in: CLEANUP.legacyCompanies.map((c) => c.name) },
		},
		select: { id: true, email: true, companyName: true },
	});

	return rows.filter((row) => {
		const company = CLEANUP.legacyCompanies.find(
			(c) => c.name === row.companyName,
		);
		return (
			company !== undefined &&
			row.email?.toLowerCase().endsWith(`@${company.domain}`) === true
		);
	});
}

type Linked = { table: string; id: string; parents: string[]; label: string };

async function findLinked(
	dealIds: string[],
	contactIds: string[],
): Promise<Linked[]> {
	const byDeal = { dealId: { in: dealIds } };
	const byContact = { contactId: { in: contactIds } };
	const either = { OR: [byDeal, byContact] };
	const parentsOf = (row: {
		dealId?: string | null;
		contactId?: string | null;
	}) => [
		...(row.dealId && dealIds.includes(row.dealId)
			? [`deal ${row.dealId}`]
			: []),
		...(row.contactId && contactIds.includes(row.contactId)
			? [`contact ${row.contactId}`]
			: []),
	];

	const [
		estimates,
		invoices,
		drawings,
		projects,
		contracts,
		permits,
		photos,
		jobCosts,
		submissions,
		fieldValues,
		conversations,
		threads,
		events,
		visitors,
		activities,
	] = await Promise.all([
		db.estimate.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, title: true },
		}),
		db.invoice.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, number: true },
		}),
		db.drawing.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, title: true },
		}),
		db.project.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, name: true },
		}),
		db.contract.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, title: true },
		}),
		db.permit.findMany({
			where: byDeal,
			select: { id: true, dealId: true },
		}),
		db.photo.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
		}),
		db.jobCost.findMany({
			where: byDeal,
			select: { id: true, dealId: true },
		}),
		db.formSubmission.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
		}),
		db.fieldValue.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
		}),
		db.agentConversation.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
		}),
		db.emailThread.findMany({
			where: byContact,
			select: { id: true, contactId: true },
		}),
		db.calendarEvent.findMany({
			where: byContact,
			select: { id: true, contactId: true },
		}),
		db.trackedVisitor.findMany({
			where: byContact,
			select: { id: true, contactId: true },
		}),
		db.activity.findMany({
			where: {
				...either,
				type: { not: ActivityType.STAGE_CHANGE },
			},
			select: {
				id: true,
				dealId: true,
				contactId: true,
				type: true,
				subject: true,
				body: true,
			},
		}),
	]);

	const subjects: readonly string[] = CLEANUP.legacyActivitySubjects;
	const bodies: readonly string[] = CLEANUP.legacyNoteBodies;
	const realActivities = activities.filter(
		(row) =>
			!(row.subject !== null && subjects.includes(row.subject)) &&
			!(row.body !== null && bodies.includes(row.body)),
	);

	const tag = <
		T extends { id: string; dealId?: string | null; contactId?: string | null },
	>(
		table: string,
		rows: T[],
		label: (row: T) => string,
	): Linked[] =>
		rows.map((row) => ({
			table,
			id: row.id,
			parents: parentsOf(row),
			label: label(row),
		}));

	return [
		...tag("estimate", estimates, (r) => r.title ?? ""),
		...tag("invoice", invoices, (r) => String(r.number ?? "")),
		...tag("drawing", drawings, (r) => r.title),
		...tag("project", projects, (r) => r.name),
		...tag("contract", contracts, (r) => r.title ?? ""),
		...tag("permit", permits, () => ""),
		...tag("photo", photos, () => ""),
		...tag("jobCost", jobCosts, () => ""),
		...tag("formSubmission", submissions, () => ""),
		...tag("fieldValue", fieldValues, () => ""),
		...tag("agentConversation", conversations, () => ""),
		...tag("emailThread", threads, () => ""),
		...tag("calendarEvent", events, () => ""),
		...tag("trackedVisitor", visitors, () => ""),
		...tag("activity", realActivities, (r) => `${r.type} ${r.subject ?? ""}`),
	];
}

async function deleteLinked(linked: Linked[]): Promise<void> {
	const ids = (table: string) =>
		linked.filter((row) => row.table === table).map((row) => row.id);
	const where = (table: string) => ({ where: { id: { in: ids(table) } } });

	await db.$transaction([
		db.contract.deleteMany(where("contract")),
		db.project.deleteMany(where("project")),
		db.invoice.deleteMany(where("invoice")),
		db.estimate.deleteMany(where("estimate")),
		db.drawing.deleteMany(where("drawing")),
		db.permit.deleteMany(where("permit")),
		db.photo.deleteMany(where("photo")),
		db.jobCost.deleteMany(where("jobCost")),
		db.formSubmission.deleteMany(where("formSubmission")),
		db.fieldValue.deleteMany(where("fieldValue")),
		db.agentConversation.deleteMany(where("agentConversation")),
		db.emailThread.deleteMany(where("emailThread")),
		db.calendarEvent.deleteMany(where("calendarEvent")),
		db.trackedVisitor.deleteMany(where("trackedVisitor")),
		db.activity.deleteMany(where("activity")),
	]);
}

function printCounts(
	title: string,
	counts: Record<CountedTable, number>,
	before?: Record<CountedTable, number>,
): void {
	console.log(`\n${title}`);
	for (const table of CLEANUP.counted) {
		const delta = before ? counts[table] - before[table] : 0;
		const suffix =
			before && delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : "";
		console.log(`  ${table.padEnd(18)} ${counts[table]}${suffix}`);
	}
}

async function main() {
	console.log(
		`Database ${name}. Mode: ${apply ? "APPLY" : "DRY RUN"}${includeLinked ? ", include linked" : ""}.`,
	);

	const before = await countAll();
	printCounts("Before", before);

	const candidateDealIds = (
		await db.deal.findMany({
			where: { id: { in: legacyDealIds() } },
			select: { id: true },
		})
	).map((row) => row.id);
	const candidateContacts = await findLegacyContacts();
	const candidateContactIds = candidateContacts.map((row) => row.id);

	const linked = await findLinked(candidateDealIds, candidateContactIds);
	const blocked = new Set(linked.flatMap((row) => row.parents));
	const blockedDealLinks = await db.dealContact.findMany({
		where: {
			dealId: {
				in: candidateDealIds.filter((id) => blocked.has(`deal ${id}`)),
			},
			contactId: { in: candidateContactIds },
		},
		select: { contactId: true },
	});
	for (const link of blockedDealLinks) blocked.add(`contact ${link.contactId}`);

	console.log(
		`\nUpstream demo records: ${candidateDealIds.length} deals, ${candidateContactIds.length} contacts.`,
	);

	if (linked.length > 0) {
		console.log(
			`\nRecords linked to demo deals or contacts (${linked.length}). ${
				includeLinked
					? "They are deleted with --include-linked."
					: "Their parents are kept. Pass --include-linked to delete them."
			}`,
		);
		for (const row of linked) {
			console.log(
				`  ${row.table.padEnd(18)} ${row.id}  on ${row.parents.join(" + ")}  ${row.label}`,
			);
		}
	}

	const dealIds = includeLinked
		? candidateDealIds
		: candidateDealIds.filter((id) => !blocked.has(`deal ${id}`));
	const contactIds = includeLinked
		? candidateContactIds
		: candidateContactIds.filter((id) => !blocked.has(`contact ${id}`));

	const orphanNotes = await db.activity.count({
		where: {
			dealId: null,
			contactId: null,
			type: ActivityType.NOTE,
			body: { in: [...CLEANUP.legacyNoteBodies] },
		},
	});
	const legacyRates = await db.exchangeRate.count({
		where: {
			provider: CLEANUP.legacyRateProvider,
			quoteCurrency: { not: "USD" },
		},
	});

	console.log(
		`\nPlan: delete ${dealIds.length} deals, ${contactIds.length} contacts, ` +
			`${orphanNotes} orphan demo notes, ${legacyRates} seeded exchange rates` +
			`${includeLinked ? `, ${linked.length} linked records` : ""}. ` +
			"Then insert the roofing demo data.",
	);
	const keptDeals = candidateDealIds.filter((id) => !dealIds.includes(id));
	const keptContacts = candidateContacts.filter(
		(row) => !contactIds.includes(row.id),
	);
	if (keptDeals.length > 0) console.log(`Kept deals: ${keptDeals.join(", ")}`);
	if (keptContacts.length > 0) {
		console.log(
			`Kept contacts: ${keptContacts.map((row) => row.email).join(", ")}`,
		);
	}

	if (!apply) {
		console.log("\nDry run. Nothing changed. Pass --apply to run it.");
		return;
	}

	if (includeLinked) await deleteLinked(linked);

	await db.$transaction([
		db.deal.deleteMany({ where: { id: { in: dealIds } } }),
		db.contact.deleteMany({ where: { id: { in: contactIds } } }),
		db.activity.deleteMany({
			where: {
				dealId: null,
				contactId: null,
				type: ActivityType.NOTE,
				body: { in: [...CLEANUP.legacyNoteBodies] },
			},
		}),
		db.exchangeRate.deleteMany({
			where: {
				provider: CLEANUP.legacyRateProvider,
				quoteCurrency: { not: "USD" },
			},
		}),
	]);

	const seeded = await seedDemo();
	console.log(
		`\nRoofing demo: ${seeded.contacts} contacts, ${seeded.deals} deals, ${seeded.activities} activities.`,
	);

	printCounts("After", await countAll(), before);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
