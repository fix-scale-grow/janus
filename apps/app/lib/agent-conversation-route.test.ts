import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	conversationFiling,
	fileBridgeConversation,
	isSessionCreate,
	requestedSessionId,
	sessionOwnedBy,
} from "./agent-conversation-route";

const suffix = process.env.TEST_RUN_ID ?? "agent-conversation-route";
const ownerId = `bridge-owner-${suffix}`;
const strangerId = `bridge-stranger-${suffix}`;
const email = `bridge.contact.${suffix}@example.test`;

let contactId: string;

async function refusal(promise: Promise<unknown>): Promise<unknown> {
	return promise.then(
		() => null,
		(error: unknown) => error,
	);
}

beforeAll(async () => {
	await db.agentConversation.deleteMany({
		where: { userId: { in: [ownerId, strangerId] } },
	});
	await db.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
	await db.contact.deleteMany({ where: { email } });
	await db.user.createMany({
		data: [ownerId, strangerId].map((id) => ({
			id,
			name: id,
			email: `${id}@example.test`,
		})),
	});
	const contact = await db.contact.create({
		data: { firstName: "Bridge", lastName: "Subject", email },
		select: { id: true },
	});
	contactId = contact.id;
});

afterAll(async () => {
	await db.agentConversation.deleteMany({
		where: { userId: { in: [ownerId, strangerId] } },
	});
	await db.contact.deleteMany({ where: { email } });
	await db.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
});

describe("session paths", () => {
	test("reads the session id from stream, continue and cancel paths", () => {
		expect(requestedSessionId("/eve/v1/session/ses_1/stream")).toBe("ses_1");
		expect(requestedSessionId("/eve/v1/session/ses_1")).toBe("ses_1");
		expect(requestedSessionId("/eve/v1/session/ses_1/cancel")).toBe("ses_1");
	});

	test("names no session when a new chat starts or a session resets", () => {
		expect(requestedSessionId("/eve/v1/session")).toBeNull();
		expect(requestedSessionId("/eve/v1/session/reset")).toBeNull();
		expect(isSessionCreate("POST", "/eve/v1/session")).toBe(true);
		expect(isSessionCreate("GET", "/eve/v1/session")).toBe(false);
		expect(isSessionCreate("POST", "/eve/v1/session/ses_1")).toBe(false);
	});
});

describe("conversationFiling", () => {
	test("files a chat with no record under the workspace", () => {
		expect(conversationFiling({})).toEqual({
			kind: "WORKSPACE",
			contactId: null,
			dealId: null,
			drawingId: null,
		});
	});

	test("files a chat with one record under that record", () => {
		expect(conversationFiling({ dealId: "deal_1" })).toEqual({
			kind: "RECORD",
			contactId: null,
			dealId: "deal_1",
			drawingId: null,
		});
	});

	test("refuses a chat tagged with two records", () => {
		expect(conversationFiling({ contactId: "c", dealId: "d" })).toBeNull();
	});
});

describe("fileBridgeConversation and sessionOwnedBy", () => {
	test("files a new session for its creator and nobody else", async () => {
		const sessionId = `ses_${suffix}_record`;
		const filed = await fileBridgeConversation({
			sessionId,
			userId: ownerId,
			record: { contactId },
		});

		expect(
			await db.agentConversation.findUnique({
				where: { id: filed.id },
				select: { userId: true, kind: true, contactId: true, sessionId: true },
			}),
		).toEqual({ userId: ownerId, kind: "RECORD", contactId, sessionId });
		expect(await sessionOwnedBy(sessionId, ownerId)).toBe(true);
		expect(await sessionOwnedBy(sessionId, strangerId)).toBe(false);
	});

	test("files a workspace session with no record", async () => {
		const sessionId = `ses_${suffix}_workspace`;
		const filed = await fileBridgeConversation({
			sessionId,
			userId: ownerId,
			record: {},
		});

		expect(
			await db.agentConversation.findUnique({
				where: { id: filed.id },
				select: { kind: true, contactId: true, dealId: true, drawingId: true },
			}),
		).toEqual({
			kind: "WORKSPACE",
			contactId: null,
			dealId: null,
			drawingId: null,
		});
	});

	test("is idempotent for the same creator and filing", async () => {
		const sessionId = `ses_${suffix}_repeat`;
		const first = await fileBridgeConversation({
			sessionId,
			userId: ownerId,
			record: {},
		});
		const second = await fileBridgeConversation({
			sessionId,
			userId: ownerId,
			record: {},
		});

		expect(second.id).toBe(first.id);
		expect(await db.agentConversation.count({ where: { sessionId } })).toBe(1);
	});

	test("never hands an existing session to another user", async () => {
		const sessionId = `ses_${suffix}_taken`;
		await fileBridgeConversation({ sessionId, userId: ownerId, record: {} });

		expect(
			await refusal(
				fileBridgeConversation({ sessionId, userId: strangerId, record: {} }),
			),
		).toBeInstanceOf(Error);
		expect(
			await db.agentConversation.findUnique({
				where: { sessionId },
				select: { userId: true },
			}),
		).toEqual({ userId: ownerId });
	});

	test("refuses a record chat tagged with two records", async () => {
		const sessionId = `ses_${suffix}_two`;
		expect(
			await refusal(
				fileBridgeConversation({
					sessionId,
					userId: ownerId,
					record: { contactId, dealId: "deal_2" },
				}),
			),
		).toBeInstanceOf(Error);
		expect(await db.agentConversation.count({ where: { sessionId } })).toBe(0);
	});

	test("names no owner for a session nobody filed", async () => {
		expect(await sessionOwnedBy(`ses_${suffix}_unknown`, ownerId)).toBe(false);
	});
});
