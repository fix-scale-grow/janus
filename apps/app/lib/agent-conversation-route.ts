import { db, Prisma } from "@crm/db";

export const AGENT_SESSION_ROUTE = {
	prefix: ["eve", "v1", "session"],
	sessionHeader: "x-eve-session-id",
	resetSegment: "reset",
	actionMethods: { stream: "GET", cancel: "POST" },
} as const;

export type EveRoute =
	| { kind: "create"; path: string }
	| { kind: "reset"; path: string }
	| {
			kind: "session";
			action: "continue" | "stream" | "cancel";
			sessionId: string;
			path: string;
	  };

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

export function matchEveRoute(
	method: string,
	pathname: string,
): EveRoute | null {
	const segments = decodedSegments(pathname);
	if (!segments) return null;

	const { prefix, resetSegment, actionMethods } = AGENT_SESSION_ROUTE;
	if (
		segments.length < prefix.length ||
		prefix.some((part, index) => segments[index] !== part)
	) {
		return null;
	}

	const base = `/${prefix.join("/")}`;
	const [id, action, ...rest] = segments.slice(prefix.length);
	if (rest.length > 0) return null;

	if (id === undefined) {
		return method === "POST" ? { kind: "create", path: base } : null;
	}

	if (id === resetSegment && action === undefined) {
		return method === "POST"
			? { kind: "reset", path: `${base}/${resetSegment}` }
			: null;
	}

	const path = `${base}/${encodeURIComponent(id)}`;
	if (action === undefined) {
		return method === "POST"
			? { kind: "session", action: "continue", sessionId: id, path }
			: null;
	}

	if (action !== "stream" && action !== "cancel") return null;
	if (method !== actionMethods[action]) return null;
	return {
		kind: "session",
		action,
		sessionId: id,
		path: `${path}/${action}`,
	};
}

function decodedSegments(pathname: string): string[] | null {
	if (!pathname.startsWith("/")) return null;
	const segments: string[] = [];
	for (const raw of pathname.slice(1).split("/")) {
		let segment: string;
		try {
			segment = decodeURIComponent(raw);
		} catch {
			return null;
		}
		if (
			segment === "" ||
			segment === "." ||
			segment === ".." ||
			segment.includes("/") ||
			segment.includes("\\") ||
			[...segment].some((character) => character.charCodeAt(0) < 32)
		) {
			return null;
		}
		segments.push(segment);
	}
	return segments;
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

export async function resetOwnedBy(
	continuationToken: string,
	userId: string,
): Promise<boolean> {
	if (!continuationToken) return false;
	const conversation = await db.agentConversation.findFirst({
		where: { continuationToken, userId },
		select: { id: true },
	});
	return conversation !== null;
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
