import { db } from "@crm/db";
import { isDerivedName } from "./names";

export type WorkItem = {
	id: string;
	fullName: string;
	email: string | null;
	title: string | null;
	companyName: string | null;
	needs: {
		identity: boolean;
		brief: boolean;
	};
};

export async function contactsNeedingWork(limit: number): Promise<WorkItem[]> {
	const rows = await db.contact.findMany({
		where: {
			OR: [
				{ brief: { is: null } },
				{ AND: [{ email: { not: null } }, { lastName: null }] },
			],
		},
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			title: true,
			companyName: true,
			brief: { select: { contactId: true } },
		},
		orderBy: { createdAt: "asc" },
		take: limit,
	});

	return rows.map((row) => ({
		id: row.id,
		fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
		email: row.email,
		title: row.title,
		companyName: row.companyName,
		needs: {
			identity: isDerivedName(row.email, row.firstName, row.lastName),
			brief: row.brief === null,
		},
	}));
}

export type CrmHistory = {
	contact: {
		fullName: string;
		email: string | null;
		title: string | null;
		companyName: string | null;
	};
	deals: {
		id: string;
		name: string;
		stage: string;
		role: string | null;
		amount: number | null;
		currency: string;
		expectedCloseDate: string | null;
	}[];
	threads: {
		subject: string | null;
		messageCount: number;
		lastMessageAt: string;
		messages: {
			direction: string;
			from: string;
			fromName: string | null;
			sentAt: string;
			body: string | null;
		}[];
	}[];
	meetings: {
		title: string | null;
		startsAt: string;
		attended: boolean;
		attendees: { email: string; name: string | null }[];
	}[];
	stats: {
		emails: number;
		theyReplied: boolean;
		lastReplyAt: string | null;
		meetings: number;
		nextMeetingAt: string | null;
	};
};

export async function readCrmHistory(
	contactId: string,
	options: {
		threads?: number;
		messagesPerThread?: number;
		includeEmail?: boolean;
		includeCalendar?: boolean;
	} = {},
): Promise<CrmHistory | null> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			title: true,
			companyName: true,
			deals: {
				orderBy: { deal: { lastActivityAt: "desc" } },
				select: {
					role: true,
					deal: {
						select: {
							id: true,
							name: true,
							stage: true,
							amount: true,
							currency: true,
							expectedCloseDate: true,
						},
					},
				},
			},
		},
	});

	if (!contact) return null;
	const includeEmail = options.includeEmail ?? true;
	const includeCalendar = options.includeCalendar ?? true;

	const [threads, meetings] = await Promise.all([
		includeEmail
			? db.emailThread.findMany({
					where: { contactId },
					orderBy: { lastMessageAt: "desc" },
					take: options.threads ?? 5,
					select: {
						subject: true,
						messageCount: true,
						lastMessageAt: true,
						messages: {
							orderBy: { sentAt: "desc" },
							take: options.messagesPerThread ?? 6,
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
		includeCalendar
			? db.calendarEvent.findMany({
					where: {
						OR: [{ contactId }, { attendees: { some: { contactId } } }],
					},
					orderBy: { startsAt: "desc" },
					take: 10,
					select: {
						title: true,
						startsAt: true,
						attendees: {
							select: {
								email: true,
								name: true,
								contactId: true,
								responseStatus: true,
							},
						},
					},
				})
			: Promise.resolve([]),
	]);

	const inbound = threads
		.flatMap((thread) => thread.messages)
		.filter((message) => message.direction === "INBOUND")
		.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

	const now = new Date();
	const upcoming = meetings
		.filter((meeting) => meeting.startsAt > now)
		.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

	return {
		contact: {
			fullName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
			email: contact.email,
			title: contact.title,
			companyName: contact.companyName,
		},
		deals: contact.deals.map(({ role, deal }) => ({
			id: deal.id,
			name: deal.name,
			stage: deal.stage,
			role,
			amount: deal.amount === null ? null : Number(deal.amount),
			currency: deal.currency,
			expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
		})),
		threads: threads.map((thread) => ({
			subject: thread.subject,
			messageCount: thread.messageCount,
			lastMessageAt: thread.lastMessageAt.toISOString(),
			messages: thread.messages.map((message) => ({
				direction: message.direction,
				from: message.fromEmail,
				fromName: message.fromName,
				sentAt: message.sentAt.toISOString(),
				body: message.body ?? message.snippet,
			})),
		})),
		meetings: meetings.map((meeting) => ({
			title: meeting.title,
			startsAt: meeting.startsAt.toISOString(),
			attended: meeting.attendees.some(
				(attendee) =>
					attendee.contactId === contactId &&
					attendee.responseStatus === "accepted",
			),
			attendees: meeting.attendees.map((attendee) => ({
				email: attendee.email,
				name: attendee.name,
			})),
		})),
		stats: {
			emails: threads.reduce((total, thread) => total + thread.messageCount, 0),
			theyReplied: inbound.length > 0,
			lastReplyAt: inbound[0]?.sentAt.toISOString() ?? null,
			meetings: meetings.length,
			nextMeetingAt: upcoming[0]?.startsAt.toISOString() ?? null,
		},
	};
}

export async function writeTimelineNote(
	contactId: string,
	subject: string,
	body: string,
	meta: Record<string, unknown> = {},
): Promise<string | null> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: { ownerId: true },
	});
	if (!contact) return null;

	const author =
		contact.ownerId ??
		(await db.user.findFirst({ select: { id: true } }))?.id ??
		null;
	if (!author) return null;

	const activity = await db.activity.create({
		data: {
			type: "NOTE",
			subject,
			body,
			occurredAt: new Date(),
			contactId,
			createdById: author,
			meta: { ...meta, agent: "people-research" },
		},
		select: { id: true },
	});

	return activity.id;
}
