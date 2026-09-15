import { db, Prisma } from "@crm/db";

export const AGENT_SESSION_ROUTE = {
	createPath: "/eve/v1/session",
	sessionHeader: "x-eve-session-id",
	reservedSegments: ["reset"],
} as const;

export type BridgeRecord = {
	contactId?: string;
	dealId?: string;
	drawingId?: string;
};

export type ConversationFiling = {
	kind: "RECORD" | "WORKSPACE";
	contactId: string | null;
	dealId: string | null;
	drawingId: string | null;
};

export function requestedSessionId(pathname: string): string | null {
	const match = pathname.match(/\/eve\/v1\/session\/([^/]+)/);
	const segment = match?.[1] ? decodeURIComponent(match[1]) : null;
	if (!segment) return null;
	return (AGENT_SESSION_ROUTE.reservedSegments as readonly string[]).includes(
		segment,
	)
		? null
		: segment;
}

export function isSessionCreate(method: string, pathname: string): boolean {
	return method === "POST" && pathname === AGENT_SESSION_ROUTE.createPath;
}

export function conversationFiling(
	record: BridgeRecord,
): ConversationFiling | null {
	const anchors = [record.contactId, record.dealId, record.drawingId].filter(
		Boolean,
	);
	if (anchors.length > 1) return null;
	return {
		kind: anchors.length === 1 ? "RECORD" : "WORKSPACE",
		contactId: record.contactId ?? null,
		dealId: record.dealId ?? null,
		drawingId: record.drawingId ?? null,
	};
}

export async function sessionOwnedBy(
	sessionId: string,
	userId: string,
): Promise<boolean> {
	const conversation = await db.agentConversation.findUnique({
		where: { sessionId },
		select: { userId: true },
	});
	return conversation?.userId === userId;
}

export async function fileBridgeConversation(input: {
	sessionId: string;
	userId: string;
	record: BridgeRecord;
}): Promise<{ id: string }> {
	const filing = conversationFiling(input.record);
	if (!filing) {
		throw new Error(
			`Session ${input.sessionId} names more than one CRM record, so it cannot be filed.`,
		);
	}

	try {
		return await db.agentConversation.create({
			data: {
				...filing,
				sessionId: input.sessionId,
				userId: input.userId,
				lastMessageAt: new Date(),
			},
			select: { id: true },
		});
	} catch (error) {
		if (
			!(error instanceof Prisma.PrismaClientKnownRequestError) ||
			error.code !== "P2002"
		) {
			throw error;
		}
		const existing = await db.agentConversation.findUnique({
			where: { sessionId: input.sessionId },
			select: {
				id: true,
				userId: true,
				kind: true,
				contactId: true,
				dealId: true,
				drawingId: true,
			},
		});
		if (
			!existing ||
			existing.userId !== input.userId ||
			existing.kind !== filing.kind ||
			existing.contactId !== filing.contactId ||
			existing.dealId !== filing.dealId ||
			existing.drawingId !== filing.drawingId
		) {
			throw new Error(
				`Session ${input.sessionId} is already filed under another conversation.`,
			);
		}
		return { id: existing.id };
	}
}
