import { DealStage, db } from "@crm/db";
import { LOSING_DEAL_STAGES, OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import { normalise } from "./names";
import { fenceUntrusted } from "./untrusted";

export type RecordKind = "contact" | "deal";

export type ContactHit = {
	kind: "contact";
	id: string;
	name: string;
	title: string | null;
	email: string | null;
	companyName: string | null;
	lastActivityAt: string | null;
};

export type DealHit = {
	kind: "deal";
	id: string;
	name: string;
	stage: string;
	amount: number | null;
	currency: string;
};

export type SearchHit = ContactHit | DealHit;

export type SearchResult = {
	query: string;
	contacts: ContactHit[];
	deals: DealHit[];
	total: number;
};

export type DealListStatus = "open" | "won" | "lost" | "all";

export type DealListOptions = {
	status?: DealListStatus;
	inactiveForDays?: number;
	ownerId?: string;
	limit?: number;
	cursor?: string;
	now?: Date;
};

export async function listDeals(options: DealListOptions = {}) {
	const status = options.status ?? "open";
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
	const now = options.now ?? new Date();
	const cutoff =
		options.inactiveForDays === undefined
			? null
			: new Date(
					now.getTime() - Math.max(options.inactiveForDays, 0) * 86_400_000,
				);
	const stages =
		status === "open"
			? [...OPEN_DEAL_STAGES]
			: status === "won"
				? [DealStage.CLOSED_WON]
				: status === "lost"
					? [...LOSING_DEAL_STAGES]
					: null;

	const rows = await db.deal.findMany({
		where: {
			...(stages ? { stage: { in: stages } } : {}),
			...(options.ownerId ? { ownerId: options.ownerId } : {}),
			...(cutoff
				? {
						OR: [
							{ lastActivityAt: { lte: cutoff } },
							{ lastActivityAt: null, createdAt: { lte: cutoff } },
						],
					}
				: {}),
		},
		orderBy: [
			{ lastActivityAt: { sort: "asc", nulls: "first" } },
			{ createdAt: "asc" },
			{ id: "asc" },
		],
		...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
		take: limit + 1,
		select: {
			id: true,
			name: true,
			stage: true,
			amount: true,
			currency: true,
			createdAt: true,
			lastActivityAt: true,
			expectedCloseDate: true,
			owner: { select: { id: true, name: true, email: true, image: true } },
		},
	});
	const hasMore = rows.length > limit;
	const page = rows.slice(0, limit);

	return {
		criteria: {
			status,
			inactiveForDays: options.inactiveForDays ?? null,
			ownerId: options.ownerId ?? null,
		},
		asOf: now.toISOString(),
		deals: page.map((deal) => {
			const activityDate = deal.lastActivityAt ?? deal.createdAt;
			return {
				id: deal.id,
				name: fenceUntrusted("deal name", deal.name),
				stage: deal.stage,
				amount: deal.amount === null ? null : Number(deal.amount),
				currency: deal.currency,
				owner: deal.owner,
				createdAt: deal.createdAt.toISOString(),
				lastActivityAt: deal.lastActivityAt?.toISOString() ?? null,
				daysSinceLastActivity: Math.max(
					0,
					Math.floor((now.getTime() - activityDate.getTime()) / 86_400_000),
				),
				neverActive: deal.lastActivityAt === null,
				expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
			};
		}),
		hasMore,
		nextCursor: hasMore ? page.at(-1)?.id : null,
	};
}

export async function searchCrm(
	query: string,
	options: { kinds?: RecordKind[]; limit?: number } = {},
): Promise<SearchResult> {
	const term = query.trim();
	const kinds = options.kinds ?? ["contact", "deal"];
	const limit = options.limit ?? 10;

	if (term.length < 2) {
		return { query: term, contacts: [], deals: [], total: 0 };
	}

	const wants = (kind: RecordKind) => kinds.includes(kind);
	const email = term.includes("@") ? term.toLowerCase() : null;
	const words = term.split(/\s+/).filter((word) => word.length >= 2);

	const [contacts, deals] = await Promise.all([
		wants("contact") ? searchContacts(term, words, email, limit) : [],
		wants("deal") ? searchDeals(term, words, limit) : [],
	]);

	return {
		query: term,
		contacts,
		deals,
		total: contacts.length + deals.length,
	};
}

async function searchContacts(
	term: string,
	words: string[],
	email: string | null,
	limit: number,
): Promise<ContactHit[]> {
	const contains = words.flatMap((word) => [
		{ firstName: { contains: word, mode: "insensitive" as const } },
		{ lastName: { contains: word, mode: "insensitive" as const } },
		{ email: { contains: word, mode: "insensitive" as const } },
		{ companyName: { contains: word, mode: "insensitive" as const } },
	]);

	const rows = await db.contact.findMany({
		where: {
			OR: [
				...(email
					? [{ email: { equals: email, mode: "insensitive" as const } }]
					: []),
				...contains,
				{ companyName: { contains: term, mode: "insensitive" as const } },
			],
		},
		orderBy: [{ lastActivityAt: "desc" }, { createdAt: "asc" }],
		take: limit * 3,
		select: {
			id: true,
			firstName: true,
			lastName: true,
			title: true,
			email: true,
			companyName: true,
			lastActivityAt: true,
		},
	});

	return rows
		.map((row) => {
			const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
			return {
				score: score(term, [name, row.email ?? "", row.companyName ?? ""]),
				hit: {
					kind: "contact" as const,
					id: row.id,
					name: fenceUntrusted("contact name", name),
					title: row.title ? fenceUntrusted("contact title", row.title) : null,
					email: row.email,
					companyName: row.companyName
						? fenceUntrusted("company name", row.companyName)
						: null,
					lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
				},
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((row) => row.hit);
}

async function searchDeals(
	term: string,
	words: string[],
	limit: number,
): Promise<DealHit[]> {
	const rows = await db.deal.findMany({
		where: {
			OR: [
				{ name: { contains: term, mode: "insensitive" } },
				...words.map((word) => ({
					name: { contains: word, mode: "insensitive" as const },
				})),
			],
		},
		orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
		take: limit * 3,
		select: {
			id: true,
			name: true,
			stage: true,
			amount: true,
			currency: true,
		},
	});

	return rows
		.map((row) => ({
			score: score(term, [row.name]),
			hit: {
				kind: "deal" as const,
				id: row.id,
				name: fenceUntrusted("deal name", row.name),
				stage: row.stage,
				amount: row.amount === null ? null : Number(row.amount),
				currency: row.currency,
			},
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((row) => row.hit);
}

function score(term: string, fields: string[]): number {
	const needle = normalise(term);
	if (!needle) return 0;

	let best = 0;
	for (const field of fields) {
		const hay = normalise(field);
		if (!hay) continue;
		if (hay === needle) best = Math.max(best, 4);
		else if (hay.startsWith(needle)) best = Math.max(best, 3);
		else if (hay.includes(needle)) best = Math.max(best, 2);
	}
	if (best > 0) return best;

	const words = term
		.split(/\s+/)
		.map(normalise)
		.filter((word) => word.length >= 2);
	if (words.length === 0) return 0;

	const hay = fields.map(normalise).join(" ");
	return words.filter((word) => hay.includes(word)).length / words.length;
}
