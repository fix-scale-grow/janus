const CLEANUP = {
	allowedDatabases: ["janus_shakeup_dev", "crm", "janus_shakeup_scriptcheck"],
	transactionTimeoutMs: 120_000,
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
	legacyDealNameSuffixes: [" — Comp AI", " — expansion"],
	legacyFirstNames: [
		"Amara",
		"Ben",
		"Chidi",
		"Dana",
		"Elias",
		"Farah",
		"Gus",
		"Hana",
		"Ines",
		"Jonas",
		"Kofi",
		"Lena",
		"Mateo",
		"Nadia",
		"Omar",
		"Pia",
		"Quinn",
		"Rosa",
		"Sami",
		"Tara",
		"Ugo",
		"Vera",
		"Wes",
		"Yuki",
	],
	legacyLastNames: [
		"Adeyemi",
		"Bergström",
		"Chen",
		"Dubois",
		"Eriksen",
		"Fontaine",
		"Gupta",
		"Haddad",
		"Ivanova",
		"Jensen",
		"Kowalski",
		"Lombardi",
		"Moreau",
		"Nakamura",
		"Oyelaran",
		"Petrov",
		"Quintana",
		"Rossi",
		"Sørensen",
		"Takahashi",
	],
	legacyUsers: [
		{ id: "seed-ada-okafor", email: "ada@trycomp.ai" },
		{ id: "seed-marcus-lindqvist", email: "marcus@trycomp.ai" },
		{ id: "seed-priya-raman", email: "priya@trycomp.ai" },
	],
	legacyUserIdPrefix: "seed-",
	legacyNoteBodies: [
		"Ran through the SOC 2 timeline. They want evidence collection automated before the audit window opens.",
		"Procurement wants a security questionnaire back before they will look at pricing.",
		"Champion is keen, but the budget owner has not been in a call yet.",
		"They are evaluating us against two others. Differentiator is the agent, not the checklist.",
		"Asked for a reference in the same vertical. Following up with marketing.",
		"Pushed the decision to after their board meeting.",
	],
	legacyActivitySubjects: [
		"Stage changed",
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
	reportingCurrency: "USD",
	renameEmailDomain: "example.com",
	legacyDealDescriptions: [
		"Replacing a spreadsheet-and-Drive evidence process before their first SOC 2 audit. Security owns the decision, finance signs.",
		"Expansion onto the platform team after the security org went live. Blocked on whether the current contract can be co-termed.",
		"Inbound from a failed vendor renewal. They want automated evidence collection and one auditor-ready report.",
		"Their enterprise deals keep stalling on security questionnaires. The buying trigger is the pipeline, not the audit.",
		"Champion ran the evaluation themselves and wants the agent, not the checklist. Procurement is the long pole.",
	],
	legacyTitles: [
		"Head of Security",
		"CTO",
		"VP Engineering",
		"Compliance Manager",
		"Head of Legal",
		"Security Engineer",
		"COO",
		"IT Director",
		"Head of Platform",
		"Chief of Staff",
	],
	renamedDealJobs: [
		"Roof Replacement",
		"Storm Damage Repair",
		"Gutter Replacement",
		"Leak Repair",
		"Hail Damage Re-Roof",
		"Skylight Flashing Repair",
		"Full Tear-Off",
		"Soffit and Fascia Repair",
	],
	renamedDealDescriptions: [
		"1500 Example Ave. Full tear-off, 26 squares, architectural shingles in Pewter Gray.",
		"1510 Sample St. Wind damage on the rear slope and a missing section of ridge cap.",
		"1520 Placeholder Ln. Seamless gutters and downspouts on the whole house.",
		"1530 Demo Ct. Active leak at the chimney flashing. Ceiling stain in the upstairs bedroom.",
		"1540 Fictional Dr. Hail hits on every slope. Homeowner filed the claim last week.",
		"1550 Testing Way. Water around the skylight curb. Replace flashing and the curb cladding.",
		"1560 Mockup Rd. Two layers of 3-tab to remove. New underlayment and ridge vent.",
		"1570 Example Ave. Rotted fascia on the front elevation. Wants aluminum wrap.",
	],
	renamedDealNames: [
		"Lawson Roof Replacement",
		"Whitfield Storm Damage Repair",
		"Garrison Gutter Replacement",
		"Holloway Leak Repair",
		"Pruitt Hail Damage Re-Roof",
		"Mercer Skylight Flashing Repair",
		"Tanner Full Tear-Off",
		"Bishop Soffit and Fascia Repair",
	],
	renamedContacts: [
		{ firstName: "Paul", lastName: "Lawson" },
		{ firstName: "Nora", lastName: "Whitfield" },
		{ firstName: "Grant", lastName: "Garrison" },
		{ firstName: "Lucy", lastName: "Holloway" },
		{ firstName: "Wade", lastName: "Pruitt" },
		{ firstName: "Irene", lastName: "Mercer" },
		{ firstName: "Doug", lastName: "Tanner" },
		{ firstName: "Ruth", lastName: "Bishop" },
	],
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
		"contactFact",
		"contactBrief",
		"calendarAttendee",
		"agentTask",
		"agentEvent",
		"recentRecord",
		"user",
		"account",
		"member",
		"accessGroup",
		"service",
		"symbol",
		"template",
		"form",
	],
} as const;

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const includeLinked = args.has("--include-linked");
const renameLinked = args.has("--rename-linked");
const renamePlaceholderUsers = args.has("--rename-placeholder-users");

function urlDatabaseName(url: string): string {
	try {
		return new URL(url).pathname.replace(/^\//, "");
	} catch {
		return "";
	}
}

const allowed: readonly string[] = CLEANUP.allowedDatabases;
const urlName = urlDatabaseName(process.env.DATABASE_URL ?? "");

if (process.env.NODE_ENV === "test") {
	console.error("Refusing to run with NODE_ENV=test.");
	process.exit(1);
}

if (!allowed.includes(urlName)) {
	console.error(
		`Refusing to run against "${urlName}". Allowed: ${CLEANUP.allowedDatabases.join(", ")}.`,
	);
	process.exit(1);
}

const { db } = await import("../src/client");
const { OWNERS, seedDemo, slug } = await import("../prisma/demo-data");
const { ActivityType } = await import("../src/generated/prisma/enums");

type Client = Omit<
	typeof db,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
type CountedTable = (typeof CLEANUP.counted)[number];
type Delegate = { count: () => Promise<number> };

async function assertDatabase(): Promise<void> {
	const rows = await db.$queryRaw<
		{ current_database: string }[]
	>`select current_database()`;
	const actual = rows[0]?.current_database ?? "";
	if (actual !== urlName || !allowed.includes(actual)) {
		throw new Error(
			`Connected database "${actual}" does not match "${urlName}" or is not allowed.`,
		);
	}
}

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

function nth<T>(items: readonly T[], index: number): T {
	const item = items[index % items.length];
	if (item === undefined) throw new Error("empty rename list");
	return item;
}

function round(index: number, length: number): string {
	return index < length ? "" : String(Math.floor(index / length) + 1);
}

type Linked = { table: string; id: string; parents: string[]; label: string };

type Plan = {
	candidateDealIds: string[];
	candidateContactIds: string[];
	linked: Linked[];
	deleteDealIds: string[];
	deleteContactIds: string[];
	keptDealIds: string[];
	keptContactIds: string[];
	legacyActivityIds: string[];
	orphanNoteIds: string[];
	rateIds: string[];
	pointers: {
		agentTaskIds: string[];
		agentEventIds: string[];
		recentRecordIds: string[];
	};
	dealRenames: {
		id: string;
		from: string;
		to: string;
		currency: string;
		amount: string | null;
		nameFrom: string;
		description: string | null;
		keptDescription: string | null;
	}[];
	contactRenames: {
		id: string;
		from: string | null;
		firstName: string;
		lastName: string;
		email: string;
		clearTitle: boolean;
		keptTitle: string | null;
	}[];
	moneyFixes: {
		estimateIds: string[];
		invoiceIds: string[];
		jobCostIds: string[];
	};
	userRenames: { id: string; from: string; name: string; email: string }[];
	accountUpdates: { id: string; accountId: string }[];
	conflicts: string[];
};

async function findCandidateContacts(client: Client) {
	const firstNames: readonly string[] = CLEANUP.legacyFirstNames;
	const lastNames: readonly string[] = CLEANUP.legacyLastNames;
	const rows = await client.contact.findMany({
		where: {
			companyName: { in: CLEANUP.legacyCompanies.map((c) => c.name) },
		},
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			companyName: true,
			title: true,
		},
		orderBy: { id: "asc" },
	});

	return rows.filter((row) => {
		const company = CLEANUP.legacyCompanies.find(
			(c) => c.name === row.companyName,
		);
		if (!company || row.lastName === null) return false;
		return (
			firstNames.includes(row.firstName) &&
			lastNames.includes(row.lastName) &&
			row.email ===
				`${slug(row.firstName)}.${slug(row.lastName)}@${company.domain}`
		);
	});
}

async function scanLinked(
	client: Client,
	dealIds: string[],
	contactIds: string[],
): Promise<{ linked: Linked[]; legacyActivityIds: string[] }> {
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
		facts,
		briefs,
		attendees,
		dismissals,
		dealLinks,
		activities,
	] = await Promise.all([
		client.estimate.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, title: true },
			orderBy: { id: "asc" },
		}),
		client.invoice.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, number: true },
			orderBy: { id: "asc" },
		}),
		client.drawing.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, title: true },
			orderBy: { id: "asc" },
		}),
		client.project.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, name: true },
			orderBy: { id: "asc" },
		}),
		client.contract.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true, title: true },
			orderBy: { id: "asc" },
		}),
		client.permit.findMany({
			where: byDeal,
			select: { id: true, dealId: true },
			orderBy: { id: "asc" },
		}),
		client.photo.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
			orderBy: { id: "asc" },
		}),
		client.jobCost.findMany({
			where: byDeal,
			select: { id: true, dealId: true },
			orderBy: { id: "asc" },
		}),
		client.formSubmission.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
			orderBy: { id: "asc" },
		}),
		client.fieldValue.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
			orderBy: { id: "asc" },
		}),
		client.agentConversation.findMany({
			where: either,
			select: { id: true, dealId: true, contactId: true },
			orderBy: { id: "asc" },
		}),
		client.emailThread.findMany({
			where: byContact,
			select: { id: true, contactId: true },
			orderBy: { id: "asc" },
		}),
		client.calendarEvent.findMany({
			where: byContact,
			select: { id: true, contactId: true },
			orderBy: { id: "asc" },
		}),
		client.trackedVisitor.findMany({
			where: byContact,
			select: { id: true, contactId: true },
			orderBy: { id: "asc" },
		}),
		client.contactFact.findMany({
			where: byContact,
			select: { id: true, contactId: true, field: true },
			orderBy: { id: "asc" },
		}),
		client.contactBrief.findMany({
			where: byContact,
			select: { contactId: true },
			orderBy: { contactId: "asc" },
		}),
		client.calendarAttendee.findMany({
			where: byContact,
			select: { id: true, contactId: true, email: true },
			orderBy: { id: "asc" },
		}),
		client.permitPromptDismissal.findMany({
			where: byDeal,
			select: { id: true, dealId: true },
			orderBy: { id: "asc" },
		}),
		client.dealContact.findMany({
			where: {
				OR: [
					{ dealId: { in: dealIds }, contactId: { notIn: contactIds } },
					{ contactId: { in: contactIds }, dealId: { notIn: dealIds } },
				],
			},
			select: { dealId: true, contactId: true },
			orderBy: [{ dealId: "asc" }, { contactId: "asc" }],
		}),
		client.activity.findMany({
			where: either,
			select: {
				id: true,
				dealId: true,
				contactId: true,
				type: true,
				subject: true,
				body: true,
				createdById: true,
			},
			orderBy: { id: "asc" },
		}),
	]);

	const subjects: readonly string[] = CLEANUP.legacyActivitySubjects;
	const bodies: readonly string[] = CLEANUP.legacyNoteBodies;
	const seedUsers: readonly string[] = CLEANUP.legacyUsers.map((u) => u.id);
	const isLegacy = (row: (typeof activities)[number]) =>
		seedUsers.includes(row.createdById) &&
		((row.subject !== null && subjects.includes(row.subject)) ||
			(row.type === ActivityType.NOTE &&
				row.body !== null &&
				bodies.includes(row.body)));

	const tag = <T extends { dealId?: string | null; contactId?: string | null }>(
		table: string,
		rows: T[],
		id: (row: T) => string,
		label: (row: T) => string,
	): Linked[] =>
		rows.map((row) => ({
			table,
			id: id(row),
			parents: parentsOf(row),
			label: label(row),
		}));
	const byId = <T extends { id: string }>(row: T) => row.id;

	const linked = [
		...tag("estimate", estimates, byId, (r) => r.title ?? ""),
		...tag("invoice", invoices, byId, (r) => String(r.number ?? "")),
		...tag("drawing", drawings, byId, (r) => r.title),
		...tag("project", projects, byId, (r) => r.name),
		...tag("contract", contracts, byId, (r) => r.title ?? ""),
		...tag("permit", permits, byId, () => ""),
		...tag("photo", photos, byId, () => ""),
		...tag("jobCost", jobCosts, byId, () => ""),
		...tag("formSubmission", submissions, byId, () => ""),
		...tag("fieldValue", fieldValues, byId, () => ""),
		...tag("agentConversation", conversations, byId, () => ""),
		...tag("emailThread", threads, byId, () => ""),
		...tag("calendarEvent", events, byId, () => ""),
		...tag("trackedVisitor", visitors, byId, () => ""),
		...tag("contactFact", facts, byId, (r) => r.field),
		...tag(
			"contactBrief",
			briefs,
			(r) => r.contactId,
			() => "",
		),
		...tag("calendarAttendee", attendees, byId, (r) => r.email),
		...tag("permitPromptDismissal", dismissals, byId, () => ""),
		...tag(
			"dealContact",
			dealLinks,
			(r) => `${r.dealId}:${r.contactId}`,
			(r) => `deal ${r.dealId} to contact ${r.contactId}`,
		),
		...tag(
			"activity",
			activities.filter((row) => !isLegacy(row)),
			byId,
			(r) => `${r.type} ${r.subject ?? ""} by ${r.createdById}`,
		),
	];

	return {
		linked,
		legacyActivityIds: activities.filter(isLegacy).map((row) => row.id),
	};
}

async function buildPlan(client: Client): Promise<Plan> {
	const candidateDeals = await client.deal.findMany({
		where: {
			id: { in: legacyDealIds() },
			OR: CLEANUP.legacyDealNameSuffixes.map((suffix) => ({
				name: { endsWith: suffix },
			})),
		},
		select: {
			id: true,
			name: true,
			amount: true,
			currency: true,
			description: true,
		},
		orderBy: { id: "asc" },
	});
	const candidateContacts = await findCandidateContacts(client);
	const candidateDealIds = candidateDeals.map((row) => row.id);
	const candidateContactIds = candidateContacts.map((row) => row.id);

	const { linked, legacyActivityIds } = await scanLinked(
		client,
		candidateDealIds,
		candidateContactIds,
	);
	const blocked = new Set(linked.flatMap((row) => row.parents));

	const deleteDealIds = includeLinked
		? candidateDealIds
		: candidateDealIds.filter((id) => !blocked.has(`deal ${id}`));
	const keptDealIds = candidateDealIds.filter(
		(id) => !deleteDealIds.includes(id),
	);
	const keptDealContacts = await client.dealContact.findMany({
		where: {
			dealId: { in: keptDealIds },
			contactId: { in: candidateContactIds },
		},
		select: { contactId: true },
	});
	for (const link of keptDealContacts) blocked.add(`contact ${link.contactId}`);
	const deleteContactIds = includeLinked
		? candidateContactIds
		: candidateContactIds.filter((id) => !blocked.has(`contact ${id}`));
	const keptContactIds = candidateContactIds.filter(
		(id) => !deleteContactIds.includes(id),
	);

	const deletedLinked = includeLinked ? linked : [];
	const deletedIdsOf = (table: string) =>
		deletedLinked.filter((row) => row.table === table).map((row) => row.id);

	const seedUserIds = CLEANUP.legacyUsers.map((u) => u.id);
	const [orphanNotes, rates, agentTasks, agentEvents, recentRecords] =
		await Promise.all([
			client.activity.findMany({
				where: {
					dealId: null,
					contactId: null,
					type: ActivityType.NOTE,
					createdById: { in: seedUserIds },
					body: { in: [...CLEANUP.legacyNoteBodies] },
				},
				select: { id: true },
				orderBy: { id: "asc" },
			}),
			client.exchangeRate.findMany({
				where: {
					provider: CLEANUP.legacyRateProvider,
					quoteCurrency: { not: CLEANUP.reportingCurrency },
				},
				select: { id: true },
				orderBy: { id: "asc" },
			}),
			client.agentTask.findMany({
				where: {
					OR: [
						{ dealId: { in: candidateDealIds } },
						{ contactId: { in: candidateContactIds } },
						{ drawingId: { in: deletedIdsOf("drawing") } },
					],
				},
				select: { id: true, dealId: true, contactId: true, drawingId: true },
				orderBy: { id: "asc" },
			}),
			client.agentEvent.findMany({
				where: { contactId: { in: candidateContactIds } },
				select: { id: true, contactId: true },
				orderBy: { id: "asc" },
			}),
			client.recentRecord.findMany({
				where: {
					OR: [
						{ kind: "deal", recordId: { in: candidateDealIds } },
						{ kind: "contact", recordId: { in: candidateContactIds } },
						...(
							["estimate", "invoice", "drawing", "project", "contract"] as const
						).map((kind) => ({ kind, recordId: { in: deletedIdsOf(kind) } })),
					],
				},
				select: { id: true, kind: true, recordId: true },
				orderBy: { id: "asc" },
			}),
		]);

	const deletedRecordIds = new Set([
		...deleteDealIds,
		...deleteContactIds,
		...deletedLinked.map((row) => row.id),
	]);
	const pointsAtDeleted = (...ids: (string | null)[]) =>
		ids.some((id) => id !== null && deletedRecordIds.has(id));

	const legacyTitles: readonly string[] = CLEANUP.legacyTitles;
	const legacyDescriptions: readonly string[] = CLEANUP.legacyDealDescriptions;
	const contactRenames = renameLinked
		? candidateContacts
				.filter((contact) => keptContactIds.includes(contact.id))
				.map((contact, index) => {
					const target = nth(CLEANUP.renamedContacts, index);
					const extra = round(index, CLEANUP.renamedContacts.length);
					const clearTitle =
						contact.title !== null && legacyTitles.includes(contact.title);
					return {
						id: contact.id,
						from: contact.email,
						firstName: target.firstName,
						lastName: target.lastName,
						email: `${slug(target.firstName)}.${slug(target.lastName)}${extra ? `.${extra}` : ""}@${CLEANUP.renameEmailDomain}`,
						clearTitle,
						keptTitle: clearTitle ? null : contact.title,
					};
				})
		: [];
	const primaryLinks = renameLinked
		? await client.dealContact.findMany({
				where: {
					dealId: { in: keptDealIds },
					contactId: { in: contactRenames.map((row) => row.id) },
				},
				select: { dealId: true, contactId: true },
				orderBy: [{ createdAt: "asc" }, { contactId: "asc" }],
			})
		: [];
	const dealRenames = renameLinked
		? candidateDeals
				.filter((deal) => keptDealIds.includes(deal.id))
				.map((deal, index) => {
					const link = primaryLinks.find((row) => row.dealId === deal.id);
					const contact = contactRenames.find(
						(row) => row.id === link?.contactId,
					);
					const fallback = nth(CLEANUP.renamedDealNames, index);
					const extra = round(index, CLEANUP.renamedDealNames.length);
					const replaceDescription =
						deal.description !== null &&
						legacyDescriptions.includes(deal.description);
					return {
						id: deal.id,
						from: deal.name,
						to: contact
							? `${contact.lastName} ${nth(CLEANUP.renamedDealJobs, index)}`
							: extra
								? `${fallback} ${extra}`
								: fallback,
						currency: deal.currency,
						amount: deal.amount === null ? null : deal.amount.toString(),
						nameFrom: contact ? `contact ${contact.id}` : "fallback list",
						description: replaceDescription
							? nth(CLEANUP.renamedDealDescriptions, index)
							: null,
						keptDescription: replaceDescription ? null : deal.description,
					};
				})
		: [];

	const renamedScope = {
		OR: [
			{ dealId: { in: dealRenames.map((row) => row.id) } },
			{ contactId: { in: contactRenames.map((row) => row.id) } },
		],
	};
	const nonUsd = { currency: { not: CLEANUP.reportingCurrency } };
	const [estimates, invoices, jobCosts] = renameLinked
		? await Promise.all([
				client.estimate.findMany({
					where: { AND: [renamedScope, nonUsd] },
					select: { id: true },
					orderBy: { id: "asc" },
				}),
				client.invoice.findMany({
					where: { AND: [renamedScope, nonUsd] },
					select: { id: true },
					orderBy: { id: "asc" },
				}),
				client.jobCost.findMany({
					where: {
						dealId: { in: dealRenames.map((row) => row.id) },
						...nonUsd,
					},
					select: { id: true },
					orderBy: { id: "asc" },
				}),
			])
		: [[], [], []];

	const legacyUserEmails: readonly string[] = CLEANUP.legacyUsers.map(
		(u) => u.email,
	);
	const placeholderUsers = renamePlaceholderUsers
		? (
				await client.user.findMany({
					where: {
						id: { startsWith: CLEANUP.legacyUserIdPrefix },
						email: { in: [...legacyUserEmails] },
					},
					select: { id: true, email: true },
					orderBy: { id: "asc" },
				})
			).filter((user) => legacyUserEmails.includes(user.email))
		: [];
	const userRenames = placeholderUsers.map((user, index) => {
		const owner = nth(OWNERS, index);
		return {
			id: user.id,
			from: user.email,
			name: owner.name,
			email: owner.email,
		};
	});
	const accounts = await client.account.findMany({
		where: { userId: { in: userRenames.map((row) => row.id) } },
		select: { id: true, userId: true, accountId: true },
		orderBy: { id: "asc" },
	});
	const accountUpdates = accounts.flatMap((account) => {
		const user = userRenames.find((row) => row.id === account.userId);
		return user && account.accountId === user.from
			? [{ id: account.id, accountId: user.email }]
			: [];
	});

	const [contactConflicts, userConflicts] = await Promise.all([
		client.contact.findMany({
			where: {
				email: { in: contactRenames.map((row) => row.email) },
				id: { notIn: contactRenames.map((row) => row.id) },
			},
			select: { email: true },
		}),
		client.user.findMany({
			where: {
				email: { in: userRenames.map((row) => row.email) },
				id: { notIn: userRenames.map((row) => row.id) },
			},
			select: { email: true },
		}),
	]);

	return {
		candidateDealIds,
		candidateContactIds,
		linked,
		deleteDealIds,
		deleteContactIds,
		keptDealIds,
		keptContactIds,
		legacyActivityIds,
		orphanNoteIds: orphanNotes.map((row) => row.id),
		rateIds: rates.map((row) => row.id),
		pointers: {
			agentTaskIds: agentTasks
				.filter((row) =>
					pointsAtDeleted(row.dealId, row.contactId, row.drawingId),
				)
				.map((row) => row.id),
			agentEventIds: agentEvents
				.filter((row) => pointsAtDeleted(row.contactId))
				.map((row) => row.id),
			recentRecordIds: recentRecords
				.filter((row) => pointsAtDeleted(row.recordId))
				.map((row) => row.id),
		},
		dealRenames,
		contactRenames,
		moneyFixes: {
			estimateIds: estimates.map((row) => row.id),
			invoiceIds: invoices.map((row) => row.id),
			jobCostIds: jobCosts.map((row) => row.id),
		},
		userRenames,
		accountUpdates,
		conflicts: [
			...contactConflicts.map((row) => `contact email ${row.email}`),
			...userConflicts.map((row) => `user email ${row.email}`),
		],
	};
}

function printPlan(plan: Plan): void {
	console.log(
		`\nUpstream demo candidates: ${plan.candidateDealIds.length} deals, ${plan.candidateContactIds.length} contacts.`,
	);

	if (plan.linked.length > 0) {
		console.log(
			`\nRecords linked to demo deals or contacts (${plan.linked.length}). ${
				includeLinked
					? "They are deleted with --include-linked, except mail and calendar sync rows, which only lose the contact link."
					: "Their parents are kept. Pass --include-linked to delete them."
			}`,
		);
		for (const row of plan.linked) {
			console.log(
				`  ${row.table.padEnd(22)} ${row.id}  on ${row.parents.join(" + ")}  ${row.label}`,
			);
		}
	}

	console.log(
		`\nDelete: ${plan.deleteDealIds.length} deals, ${plan.deleteContactIds.length} contacts, ` +
			`${plan.legacyActivityIds.length} upstream seed activities on candidates, ` +
			`${plan.orphanNoteIds.length} orphan seed notes, ${plan.rateIds.length} seeded exchange rates, ` +
			`${plan.pointers.agentTaskIds.length} agent tasks, ${plan.pointers.agentEventIds.length} agent events, ` +
			`${plan.pointers.recentRecordIds.length} recent records` +
			`${includeLinked ? `, ${plan.linked.length} linked records` : ""}.`,
	);
	if (plan.keptDealIds.length > 0) {
		console.log(`Kept deals: ${plan.keptDealIds.join(", ")}`);
	}
	if (plan.keptContactIds.length > 0) {
		console.log(`Kept contacts: ${plan.keptContactIds.join(", ")}`);
	}

	if (renameLinked) {
		console.log("\nRename linked demo records:");
		for (const row of plan.dealRenames) {
			console.log(
				`  deal ${row.id}: "${row.from}" ${row.currency} -> "${row.to}" ${CLEANUP.reportingCurrency} (name from ${row.nameFrom}; description ${row.description === null ? `kept: ${JSON.stringify(row.keptDescription)}` : "replaced"})`,
			);
		}
		for (const row of plan.contactRenames) {
			console.log(
				`  contact ${row.id}: ${row.from} -> ${row.email}, no company, title ${row.clearTitle ? "cleared" : `kept: ${JSON.stringify(row.keptTitle)}`}`,
			);
		}
		console.log(
			`  USD normalization: ${plan.moneyFixes.estimateIds.length} estimates, ${plan.moneyFixes.invoiceIds.length} invoices, ${plan.moneyFixes.jobCostIds.length} job costs.`,
		);
	}

	if (renamePlaceholderUsers) {
		console.log("\nRename placeholder users:");
		for (const row of plan.userRenames) {
			console.log(
				`  user ${row.id}: ${row.from} -> ${row.name} <${row.email}>`,
			);
		}
		console.log(
			`  Account rows keyed by the old email: ${plan.accountUpdates.length}.`,
		);
	}

	if (plan.conflicts.length > 0) {
		console.log(`\nConflicts: ${plan.conflicts.join(", ")}`);
	}
}

function signature(plan: Plan): string {
	return JSON.stringify(plan);
}

async function execute(expected: Plan): Promise<void> {
	await db.$transaction(
		async (tx) => {
			const current = await buildPlan(tx);
			if (signature(current) !== signature(expected)) {
				throw new Error(
					"The data changed after the dry scan. Nothing written.",
				);
			}
			if (current.conflicts.length > 0) {
				throw new Error(`Rename conflicts: ${current.conflicts.join(", ")}`);
			}

			const linkedIds = (table: string) =>
				includeLinked
					? current.linked
							.filter((row) => row.table === table)
							.map((row) => row.id)
					: [];
			const byIds = (table: string) => ({
				where: { id: { in: linkedIds(table) } },
			});

			if (includeLinked) {
				await tx.contract.deleteMany(byIds("contract"));
				await tx.project.deleteMany(byIds("project"));
				await tx.invoice.deleteMany(byIds("invoice"));
				await tx.estimate.deleteMany(byIds("estimate"));
				await tx.drawing.deleteMany(byIds("drawing"));
				await tx.permit.deleteMany(byIds("permit"));
				await tx.photo.deleteMany(byIds("photo"));
				await tx.jobCost.deleteMany(byIds("jobCost"));
				await tx.formSubmission.deleteMany(byIds("formSubmission"));
				await tx.fieldValue.deleteMany(byIds("fieldValue"));
				await tx.agentConversation.deleteMany(byIds("agentConversation"));
				await tx.contactFact.deleteMany(byIds("contactFact"));
				await tx.permitPromptDismissal.deleteMany(
					byIds("permitPromptDismissal"),
				);
				await tx.activity.deleteMany(byIds("activity"));
			}

			await tx.activity.deleteMany({
				where: {
					id: { in: [...current.legacyActivityIds, ...current.orphanNoteIds] },
				},
			});
			await tx.deal.deleteMany({
				where: { id: { in: current.deleteDealIds } },
			});
			await tx.contact.deleteMany({
				where: { id: { in: current.deleteContactIds } },
			});
			await tx.exchangeRate.deleteMany({
				where: { id: { in: current.rateIds } },
			});
			await tx.agentTask.deleteMany({
				where: { id: { in: current.pointers.agentTaskIds } },
			});
			await tx.agentEvent.deleteMany({
				where: { id: { in: current.pointers.agentEventIds } },
			});
			await tx.recentRecord.deleteMany({
				where: { id: { in: current.pointers.recentRecordIds } },
			});

			for (const row of current.dealRenames) {
				await tx.deal.update({
					where: { id: row.id },
					data: {
						name: row.to,
						...(row.description === null
							? {}
							: { description: row.description }),
						currency: CLEANUP.reportingCurrency,
						baseCurrency: CLEANUP.reportingCurrency,
						baseAmount: row.amount,
						fxRate: null,
						fxRateAt: null,
					},
				});
			}
			for (const row of current.contactRenames) {
				await tx.contact.update({
					where: { id: row.id },
					data: {
						firstName: row.firstName,
						lastName: row.lastName,
						email: row.email,
						companyName: null,
						...(row.clearTitle ? { title: null } : {}),
					},
				});
			}
			const usd = { data: { currency: CLEANUP.reportingCurrency } };
			await tx.estimate.updateMany({
				where: { id: { in: current.moneyFixes.estimateIds } },
				...usd,
			});
			await tx.invoice.updateMany({
				where: { id: { in: current.moneyFixes.invoiceIds } },
				...usd,
			});
			await tx.jobCost.updateMany({
				where: { id: { in: current.moneyFixes.jobCostIds } },
				...usd,
			});
			for (const row of current.userRenames) {
				await tx.user.update({
					where: { id: row.id },
					data: { name: row.name, email: row.email },
				});
			}
			for (const row of current.accountUpdates) {
				await tx.account.update({
					where: { id: row.id },
					data: { accountId: row.accountId },
				});
			}
		},
		{ timeout: CLEANUP.transactionTimeoutMs },
	);
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
		console.log(`  ${table.padEnd(22)} ${counts[table]}${suffix}`);
	}
}

async function main() {
	await assertDatabase();

	const flags = [
		includeLinked && "include linked",
		renameLinked && "rename linked",
		renamePlaceholderUsers && "rename placeholder users",
	].filter(Boolean);
	console.log(
		`Database ${urlName}. Mode: ${apply ? "APPLY" : "DRY RUN"}${flags.length ? `, ${flags.join(", ")}` : ""}.`,
	);

	const before = await countAll();
	printCounts("Before", before);

	const plan = await buildPlan(db);
	printPlan(plan);

	if (!apply) {
		console.log("\nDry run. Nothing changed. Pass --apply to run it.");
		return;
	}

	try {
		await execute(plan);
	} catch (error) {
		console.error(
			"\nTransaction rolled back. None of the planned changes above were written.",
		);
		throw error;
	}

	const seeded = await seedDemo();
	console.log(
		`\nRoofing demo: ${seeded.contacts} contacts, ${seeded.deals} deals, ${seeded.activities} activities.`,
	);

	printCounts("After", await countAll(), before);
}

try {
	await main();
} catch (error) {
	console.error(error);
	process.exitCode = 1;
} finally {
	await db.$disconnect();
}
