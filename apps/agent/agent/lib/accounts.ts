import { ActivityType, db, EmailDirection } from "@crm/db";

const BODY_LIMIT = 4000;

export type AccountThread = {
	subject: string | null;
	contact: { id: string; name: string } | null;
	messageCount: number;
	lastMessageAt: string;
	messages: {
		direction: string;
		from: string;
		fromName: string | null;
		sentAt: string;
		body: string | null;
	}[];
};

export type AccountMeeting = {
	title: string | null;
	startsAt: string;
	upcoming: boolean;
	attendees: { email: string; name: string | null }[];
};

export type AccountNote = {
	type: string;
	subject: string | null;
	body: string | null;
	occurredAt: string;
};

export type DealHistory = {
	deal: {
		id: string;
		name: string;
		description: string | null;
		stage: string;
		open: boolean;
		daysInStage: number;
		stageChangedAt: string;
		amount: number | null;
		currency: string;
		expectedCloseDate: string | null;
		closedAt: string | null;
		closedReason: string | null;
		owner: string | null;
		createdAt: string;
	};
	people: {
		id: string;
		name: string;
		title: string | null;
		email: string | null;
		role: string | null;
	}[];
	stageHistory: { from: string | null; to: string | null; at: string }[];
	threads: AccountThread[];
	meetings: AccountMeeting[];
	notes: AccountNote[];
	stats: {
		theyReplied: boolean;
		lastReplyAt: string | null;
		lastReplyFrom: string | null;
		nextMeetingAt: string | null;
		daysSinceLastActivity: number | null;
	};
	note: string;
};

export async function readDealHistory(
	dealId: string,
	options: {
		threads?: number;
		messagesPerThread?: number;
		includeEmail?: boolean;
		includeCalendar?: boolean;
	} = {},
): Promise<DealHistory | null> {
	const deal = await db.deal.findUnique({
		where: { id: dealId },
		select: {
			id: true,
			name: true,
			description: true,
			stage: true,
			stageChangedAt: true,
			amount: true,
			currency: true,
			expectedCloseDate: true,
			closedAt: true,
			closedReason: true,
			lastActivityAt: true,
			createdAt: true,
			owner: { select: { name: true, email: true } },
			contacts: {
				select: {
					role: true,
					contact: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							title: true,
							email: true,
						},
					},
				},
			},
		},
	});

	if (!deal) return null;
	const includeEmail = options.includeEmail ?? true;
	const includeCalendar = options.includeCalendar ?? true;

	const contactIds = deal.contacts.map(({ contact }) => contact.id);
	const hasContacts = contactIds.length > 0;

	const [stageChanges, threads, meetings, notes, lastInbound] =
		await Promise.all([
			db.activity.findMany({
				where: { dealId, type: ActivityType.STAGE_CHANGE },
				orderBy: { createdAt: "asc" },
				take: 25,
				select: { meta: true, createdAt: true },
			}),
			includeEmail && hasContacts
				? db.emailThread.findMany({
						where: { contactId: { in: contactIds } },
						orderBy: { lastMessageAt: "desc" },
						take: options.threads ?? 5,
						select: {
							subject: true,
							messageCount: true,
							lastMessageAt: true,
							contact: {
								select: { id: true, firstName: true, lastName: true },
							},
							messages: {
								orderBy: { sentAt: "desc" },
								take: options.messagesPerThread ?? 4,
								select: {
									direction: true,
									fromEmail: true,
									fromName: true,
									sentAt: true,
									body: true,
									snippet: true,
								},
							},
						},
					})
				: Promise.resolve([]),
			includeCalendar && hasContacts
				? db.calendarEvent.findMany({
						where: {
							OR: [
								{ contactId: { in: contactIds } },
								{ attendees: { some: { contactId: { in: contactIds } } } },
							],
						},
						orderBy: { startsAt: "desc" },
						take: 10,
						select: {
							title: true,
							startsAt: true,
							attendees: { select: { email: true, name: true } },
						},
					})
				: Promise.resolve([]),
			recentNotes(dealId),
			includeEmail && hasContacts
				? db.emailMessage.findFirst({
						where: {
							direction: EmailDirection.INBOUND,
							thread: { contactId: { in: contactIds } },
						},
						orderBy: { sentAt: "desc" },
						select: { sentAt: true, fromEmail: true, fromName: true },
					})
				: Promise.resolve(null),
		]);

	const now = new Date();

	return {
		deal: {
			id: deal.id,
			name: deal.name,
			description: deal.description,
			stage: deal.stage,
			open: isOpen(deal.stage),
			daysInStage: daysSince(deal.stageChangedAt, now),
			stageChangedAt: deal.stageChangedAt.toISOString(),
			amount: deal.amount === null ? null : Number(deal.amount),
			currency: deal.currency,
			expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
			closedAt: deal.closedAt?.toISOString() ?? null,
			closedReason: deal.closedReason,
			owner: deal.owner?.name ?? deal.owner?.email ?? null,
			createdAt: deal.createdAt.toISOString(),
		},
		people: deal.contacts.map(({ role, contact }) => ({
			id: contact.id,
			name: fullName(contact),
			title: contact.title,
			email: contact.email,
			role,
		})),
		stageHistory: stageChanges.map((change) => {
			const meta = (change.meta ?? {}) as { from?: unknown; to?: unknown };
			return {
				from: typeof meta.from === "string" ? meta.from : null,
				to: typeof meta.to === "string" ? meta.to : null,
				at: change.createdAt.toISOString(),
			};
		}),
		threads: threads.map(toAccountThread),
		meetings: meetings.map((meeting) => toAccountMeeting(meeting, now)),
		notes,
		stats: {
			theyReplied: lastInbound !== null,
			lastReplyAt: lastInbound?.sentAt.toISOString() ?? null,
			lastReplyFrom: lastInbound
				? (lastInbound.fromName ?? lastInbound.fromEmail)
				: null,
			nextMeetingAt:
				meetings
					.filter((meeting) => meeting.startsAt > now)
					.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
					?.startsAt.toISOString() ?? null,
			daysSinceLastActivity: deal.lastActivityAt
				? daysSince(deal.lastActivityAt, now)
				: null,
		},
		note:
			includeEmail || includeCalendar
				? hasContacts
					? "Connected account history is filed against people, never against a deal. The history here belongs to the people on this deal — read the details before treating any of it as being about this deal."
					: "Nobody is attached to this deal, so there is no connected correspondence to read. Attaching the people on it would make this answer sharper."
				: "Connected email and calendar history are outside this agent version's approved data sources.",
	};
}

function isOpen(stage: string): boolean {
	return (
		stage !== "CLOSED_WON" &&
		stage !== "CLOSED_LOST" &&
		stage !== "UNQUALIFIED_TO_BUY"
	);
}

async function recentNotes(dealId: string): Promise<AccountNote[]> {
	const rows = await db.activity.findMany({
		where: {
			dealId,
			type: {
				in: [
					ActivityType.NOTE,
					ActivityType.CALL,
					ActivityType.TASK,
					ActivityType.ENRICHMENT,
				],
			},
		},
		orderBy: { createdAt: "desc" },
		take: 10,
		select: {
			type: true,
			subject: true,
			body: true,
			occurredAt: true,
			createdAt: true,
		},
	});

	return rows.map((row) => ({
		type: row.type,
		subject: row.subject,
		body: row.body ? row.body.slice(0, BODY_LIMIT) : null,
		occurredAt: (row.occurredAt ?? row.createdAt).toISOString(),
	}));
}

function toAccountThread(thread: {
	subject: string | null;
	messageCount: number;
	lastMessageAt: Date;
	contact: { id: string; firstName: string; lastName: string | null } | null;
	messages: {
		direction: string;
		fromEmail: string;
		fromName: string | null;
		sentAt: Date;
		body: string | null;
		snippet: string | null;
	}[];
}): AccountThread {
	return {
		subject: thread.subject,
		contact: thread.contact
			? { id: thread.contact.id, name: fullName(thread.contact) }
			: null,
		messageCount: thread.messageCount,
		lastMessageAt: thread.lastMessageAt.toISOString(),
		messages: thread.messages.map((message) => ({
			direction: message.direction,
			from: message.fromEmail,
			fromName: message.fromName,
			sentAt: message.sentAt.toISOString(),
			body: (message.body ?? message.snippet)?.slice(0, BODY_LIMIT) ?? null,
		})),
	};
}

function toAccountMeeting(
	meeting: {
		title: string | null;
		startsAt: Date;
		attendees: { email: string; name: string | null }[];
	},
	now: Date,
): AccountMeeting {
	return {
		title: meeting.title,
		startsAt: meeting.startsAt.toISOString(),
		upcoming: meeting.startsAt > now,
		attendees: meeting.attendees,
	};
}

function fullName(person: {
	firstName: string;
	lastName: string | null;
}): string {
	return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function daysSince(date: Date, now: Date): number {
	return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}
