import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { DEFAULT_WORKSPACE_NAME, WORKSPACE_ID } from "@crm/auth";
import { db } from "@crm/db";
import { adminPrincipal, noAccessPrincipal } from "@crm/db/access-policy";
import { workspaceSlug } from "@crm/db/workspace";
import { NotFoundException } from "@nestjs/common";
import {
	builderConversationCreateInput,
	conversationListInput,
	conversationSaveInput,
} from "../src/conversations/conversations.contracts";
import { ConversationsService } from "../src/conversations/conversations.service";

const suffix = process.env.TEST_RUN_ID ?? "conversations-spec";
const email = `conversation.subject.${suffix}@example.test`;
const userId = `user-${suffix}`;
const memberId = `conversation-member-${suffix}`;

let contactId: string;
let service: ConversationsService;

async function refusal(promise: Promise<unknown>): Promise<unknown> {
	return promise.then(
		() => null,
		(error: unknown) => error,
	);
}

async function file(
	sessionId: string,
	anchor: { kind?: "WORKSPACE"; contactId?: string } = {},
	owner: string = userId,
) {
	return db.agentConversation.create({
		data: {
			kind: anchor.kind ?? "RECORD",
			sessionId,
			userId: owner,
			contactId: anchor.contactId ?? null,
		},
		select: { id: true },
	});
}

beforeAll(async () => {
	await db.agentEvent.deleteMany({
		where: {
			OR: [
				{ sessionId: { startsWith: `builder-question-${suffix}` } },
				{ sessionId: { startsWith: `ses_${suffix}` } },
			],
		},
	});
	await db.agentConversation.deleteMany({ where: { userId } });
	await db.member.deleteMany({ where: { id: memberId } });
	await db.user.deleteMany({ where: { id: userId } });
	await db.contact.deleteMany({ where: { email } });
	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		update: {},
		create: {
			id: WORKSPACE_ID,
			name: DEFAULT_WORKSPACE_NAME,
			slug: workspaceSlug(DEFAULT_WORKSPACE_NAME),
			createdAt: new Date(),
		},
	});

	await db.user.create({
		data: { id: userId, name: "Test Rep", email: `${userId}@example.test` },
	});
	await db.member.create({
		data: {
			id: memberId,
			organizationId: WORKSPACE_ID,
			userId,
			role: "member",
			createdAt: new Date(),
		},
	});
	const contact = await db.contact.create({
		data: { firstName: "Conversation", lastName: "Subject", email },
		select: { id: true },
	});
	contactId = contact.id;

	service = new ConversationsService(db);
});

afterAll(async () => {
	await db.agentEvent.deleteMany({
		where: {
			OR: [
				{ sessionId: { startsWith: `builder-question-${suffix}` } },
				{ sessionId: { startsWith: `ses_${suffix}` } },
			],
		},
	});
	await db.contact.deleteMany({ where: { email } });
	await db.agentConversation.deleteMany({ where: { userId } });
	await db.member.deleteMany({ where: { id: memberId } });
	await db.user.deleteMany({ where: { id: userId } });
});

describe("ConversationsService", () => {
	it("starts a record with no history", async () => {
		expect(
			await service.list({ contactId }, userId, adminPrincipal(userId)),
		).toEqual([]);
	});

	it("saves a cursor and titles the thread from the opening question", async () => {
		await file(`ses_${suffix}_1`, { contactId });
		await service.save(
			{
				contactId,
				sessionId: `ses_${suffix}_1`,
				continuationToken: "eve:token-1",
				streamIndex: 4,
				title: "Are they still there?",
				messageCount: 2,
			},
			userId,
			adminPrincipal(userId),
		);

		const [conversation] = await service.list(
			{ contactId },
			userId,
			adminPrincipal(userId),
		);

		expect(conversation).toMatchObject({
			sessionId: `ses_${suffix}_1`,
			continuationToken: "eve:token-1",
			streamIndex: 4,
			title: "Are they still there?",
			messageCount: 2,
		});
	});

	it("moves the cursor without renaming the thread", async () => {
		await service.save(
			{
				contactId,
				sessionId: `ses_${suffix}_1`,
				continuationToken: "eve:token-2",
				streamIndex: 9,
				messageCount: 4,
			},
			userId,
			adminPrincipal(userId),
		);

		const [conversation] = await service.list(
			{ contactId },
			userId,
			adminPrincipal(userId),
		);

		expect(conversation).toMatchObject({
			continuationToken: "eve:token-2",
			streamIndex: 9,
			title: "Are they still there?",
			messageCount: 4,
		});
	});

	it("reflects newly saved conversations immediately", async () => {
		const before = await service.list(
			{ contactId },
			userId,
			adminPrincipal(userId),
		);
		await file(`ses_${suffix}_2`, { contactId });
		expect(
			await service.list({ contactId }, userId, adminPrincipal(userId)),
		).toHaveLength(before.length + 1);
	});

	it("newest first, so reopening lands on the last thing you asked", async () => {
		const [first] = await service.list(
			{ contactId },
			userId,
			adminPrincipal(userId),
		);
		expect(first?.sessionId).toBe(`ses_${suffix}_2`);
	});

	it("keeps one rep's conversations out of another's", async () => {
		expect(
			await service.list(
				{ contactId },
				"somebody-else",
				adminPrincipal("somebody-else"),
			),
		).toEqual([]);
	});

	it("refuses a conversation that belongs to a record of neither kind", async () => {
		expect(
			await refusal(
				service.save(
					{ sessionId: `ses_${suffix}_3` },
					userId,
					adminPrincipal(userId),
				),
			),
		).toBeInstanceOf(Error);
	});

	it("requires exactly one CRM record in list and save inputs", () => {
		expect(conversationListInput.safeParse({}).success).toBe(false);
		expect(
			conversationListInput.safeParse({ contactId, dealId: "deal-1" }).success,
		).toBe(false);
		expect(
			conversationSaveInput.safeParse({
				contactId,
				dealId: "deal-1",
				sessionId: "session-1",
			}).success,
		).toBe(false);
	});

	it("opens a workspace thread that belongs to no CRM record", async () => {
		const sessionId = `ses_${suffix}_workspace`;
		await file(sessionId, { kind: "WORKSPACE" });
		const saved = await service.save(
			{
				kind: "WORKSPACE",
				sessionId,
				continuationToken: "eve:workspace-1",
				title: "How is the pipeline?",
				messageCount: 2,
			},
			userId,
			adminPrincipal(userId),
		);

		expect(
			await db.agentConversation.findUnique({
				where: { id: saved.id },
				select: {
					kind: true,
					contactId: true,
					dealId: true,
					drawingId: true,
				},
			}),
		).toEqual({
			kind: "WORKSPACE",
			contactId: null,
			dealId: null,
			drawingId: null,
		});

		const [conversation] = await service.list(
			{ kind: "WORKSPACE" },
			userId,
			adminPrincipal(userId),
		);
		expect(conversation).toMatchObject({
			sessionId,
			continuationToken: "eve:workspace-1",
			title: "How is the pipeline?",
			messageCount: 2,
		});
	});

	it("keeps one rep's workspace threads out of another's", async () => {
		await file(`ses_${suffix}_workspace_owned`, { kind: "WORKSPACE" });

		expect(
			await service.list(
				{ kind: "WORKSPACE" },
				"somebody-else",
				adminPrincipal("somebody-else"),
			),
		).toEqual([]);
	});

	it("keeps workspace threads out of a record's history", async () => {
		await file(`ses_${suffix}_workspace_scope`, { kind: "WORKSPACE" });
		const recordThreads = await service.list(
			{ contactId },
			userId,
			adminPrincipal(userId),
		);

		expect(recordThreads.map((thread) => thread.sessionId)).not.toContain(
			`ses_${suffix}_workspace_scope`,
		);
	});

	it("accepts a workspace kind with no record and refuses one with a record", () => {
		expect(conversationListInput.safeParse({ kind: "WORKSPACE" }).success).toBe(
			true,
		);
		expect(
			conversationSaveInput.safeParse({
				kind: "WORKSPACE",
				sessionId: "session-workspace",
			}).success,
		).toBe(true);
		expect(
			conversationListInput.safeParse({ kind: "WORKSPACE", contactId }).success,
		).toBe(false);
		expect(
			conversationSaveInput.safeParse({
				kind: "WORKSPACE",
				contactId,
				sessionId: "session-workspace-record",
			}).success,
		).toBe(false);
		expect(conversationListInput.safeParse({ kind: "RECORD" }).success).toBe(
			false,
		);
		expect(
			conversationSaveInput.safeParse({
				kind: "RECORD",
				sessionId: "session-record",
			}).success,
		).toBe(false);
	});

	it("does not move a workspace thread onto a CRM record", async () => {
		const sessionId = `ses_${suffix}_workspace_move`;
		await file(sessionId, { kind: "WORKSPACE" });

		let moveError: unknown;
		try {
			await service.save(
				{ contactId, sessionId },
				userId,
				adminPrincipal(userId),
			);
		} catch (error) {
			moveError = error;
		}
		expect(moveError).toBeInstanceOf(Error);
		expect(
			await db.agentConversation.findUnique({
				where: { sessionId },
				select: { kind: true, contactId: true },
			}),
		).toEqual({ kind: "WORKSPACE", contactId: null });
	});

	it("does not mutate a conversation owned by another rep", async () => {
		const sessionId = `ses_${suffix}_ownership`;
		await file(sessionId, { contactId });
		await service.save(
			{
				contactId,
				sessionId,
				continuationToken: "owner-token",
				streamIndex: 3,
			},
			userId,
			adminPrincipal(userId),
		);

		let ownershipError: unknown;
		try {
			await service.save(
				{
					contactId,
					sessionId,
					continuationToken: "attacker-token",
					streamIndex: 99,
				},
				"somebody-else",
				adminPrincipal("somebody-else"),
			);
		} catch (error) {
			ownershipError = error;
		}
		expect(ownershipError).toBeDefined();

		expect(
			await db.agentConversation.findUnique({
				where: { sessionId },
				select: { continuationToken: true, streamIndex: true },
			}),
		).toEqual({ continuationToken: "owner-token", streamIndex: 3 });
	});

	it("does not move an existing session to another CRM record", async () => {
		const sessionId = `ses_${suffix}_record`;
		await file(sessionId, { contactId });

		let recordError: unknown;
		try {
			await service.save(
				{ dealId: "another-record", sessionId },
				userId,
				adminPrincipal(userId),
			);
		} catch (error) {
			recordError = error;
		}
		expect(recordError).toBeInstanceOf(Error);
		expect((recordError as Error).message).toContain("cannot be moved");
	});

	it("deduplicates concurrent saves of the same record session", async () => {
		const sessionId = `ses_${suffix}_concurrent`;
		const filed = await file(sessionId, { contactId });
		const results = await Promise.all(
			Array.from({ length: 4 }, () =>
				service.save(
					{ contactId, sessionId, streamIndex: 7 },
					userId,
					adminPrincipal(userId),
				),
			),
		);

		expect([...new Set(results.map((result) => result.id))]).toEqual([
			filed.id,
		]);
		expect(await db.agentConversation.count({ where: { sessionId } })).toBe(1);
	});

	it("refuses to file an unknown session and creates no row", async () => {
		const sessionId = `ses_${suffix}_unknown`;

		expect(
			await refusal(
				service.save(
					{ contactId, sessionId, title: "Stolen", messageCount: 1 },
					userId,
					adminPrincipal(userId),
				),
			),
		).toBeInstanceOf(NotFoundException);
		expect(
			await refusal(
				service.save(
					{ kind: "WORKSPACE", sessionId },
					userId,
					adminPrincipal(userId),
				),
			),
		).toBeInstanceOf(NotFoundException);
		expect(await db.agentConversation.count({ where: { sessionId } })).toBe(0);
	});

	it("refuses a session another rep owns with not found and leaves it alone", async () => {
		const sessionId = `ses_${suffix}_foreign`;
		await file(sessionId, { kind: "WORKSPACE" });

		expect(
			await refusal(
				service.save(
					{ kind: "WORKSPACE", sessionId, title: "Mine now", streamIndex: 5 },
					"somebody-else",
					adminPrincipal("somebody-else"),
				),
			),
		).toBeInstanceOf(NotFoundException);
		expect(
			await db.agentConversation.findMany({
				where: { sessionId },
				select: { userId: true, title: true, streamIndex: true },
			}),
		).toEqual([{ userId, title: null, streamIndex: 0 }]);
	});

	it("titles a filed session once from the first save", async () => {
		const sessionId = `ses_${suffix}_titled`;
		const filed = await file(sessionId, { kind: "WORKSPACE" });

		const saved = await service.save(
			{
				kind: "WORKSPACE",
				sessionId,
				title: "First question",
				messageCount: 1,
			},
			userId,
			adminPrincipal(userId),
		);
		await service.save(
			{
				kind: "WORKSPACE",
				sessionId,
				title: "Second question",
				messageCount: 3,
			},
			userId,
			adminPrincipal(userId),
		);

		expect(saved.id).toBe(filed.id);
		expect(
			await db.agentConversation.findUnique({
				where: { id: filed.id },
				select: { title: true, messageCount: true },
			}),
		).toEqual({ title: "First question", messageCount: 3 });
	});

	it("refuses to save a record chat whose record left the caller's scope", async () => {
		const sessionId = `ses_${suffix}_out_of_scope`;
		await file(sessionId, { contactId });

		expect(
			await refusal(
				service.save(
					{ contactId, sessionId, streamIndex: 4 },
					userId,
					noAccessPrincipal(userId),
				),
			),
		).toBeInstanceOf(NotFoundException);
	});

	it("does not treat a builder session as a record conversation", async () => {
		const builder = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CHAT",
				message: "Summarize this customer",
				resources: [],
				attachments: [],
			},
			userId,
		);
		const sessionId = `ses_${suffix}_builder`;
		await db.agentConversation.update({
			where: { id: builder.id },
			data: { sessionId },
		});

		let saveError: unknown;
		try {
			await service.save(
				{ contactId, sessionId },
				userId,
				adminPrincipal(userId),
			);
		} catch (error) {
			saveError = error;
		}
		expect(saveError).toBeDefined();
		expect(
			await db.agentConversation.findUnique({
				where: { id: builder.id },
				select: { kind: true, contactId: true },
			}),
		).toEqual({ kind: "BUILDER", contactId: null });
	});

	it("returns the newest event window in chronological order", async () => {
		const sessionId = `ses_${suffix}_events`;
		const saved = await file(sessionId, { contactId });
		const emittedAt = new Date("2026-08-05T12:00:00.000Z");
		await db.agentEvent.createMany({
			data: [0, 1, 2, 3].map((position) => ({
				id: `evt_${suffix}_window_${position}`,
				sessionId,
				contactId,
				type: `event.${position}`,
				data: {},
				emittedAt: new Date(emittedAt.getTime() + position),
			})),
		});

		expect(
			(await service.events({ id: saved.id, limit: 2 }, userId)).map(
				(event) => event.type,
			),
		).toEqual(["event.2", "event.3"]);
	});

	it("returns builder events from descendant sessions", async () => {
		const builder = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CREATE_AGENT",
				message: "Build an agent that asks one question",
				resources: [],
				attachments: [],
			},
			userId,
		);
		const rootSessionId = `builder-question-${suffix}-root`;
		await db.agentConversation.update({
			where: { id: builder.id },
			data: { sessionId: rootSessionId },
		});
		const emittedAt = new Date("2026-08-05T13:00:00.000Z");
		await db.agentEvent.createMany({
			data: [
				{
					id: `evt_${suffix}_builder_root`,
					sessionId: rootSessionId,
					conversationId: builder.id,
					type: "actions.requested",
					data: {},
					emittedAt,
				},
				{
					id: `evt_${suffix}_builder_child`,
					sessionId: `builder-question-${suffix}-child`,
					conversationId: builder.id,
					type: "input.requested",
					data: {},
					emittedAt: new Date(emittedAt.getTime() + 1),
				},
			],
		});

		expect(
			(await service.events({ id: builder.id, limit: 10 }, userId)).map(
				(event) => event.type,
			),
		).toEqual(["actions.requested", "input.requested"]);
	});

	it("forgets a conversation and the events behind it", async () => {
		const sessionId = `ses_${suffix}_delete`;
		const conversation = await file(sessionId, { contactId });

		await db.agentEvent.create({
			data: {
				id: `evt_${suffix}`,
				sessionId,
				contactId,
				type: "turn.completed",
				data: {},
				emittedAt: new Date(),
			},
		});
		await db.agentBuilderArtifact.create({
			data: {
				conversationId: conversation.id,
				path: "agent/instructions.md",
				language: "markdown",
				content: "Temporary draft",
				revision: 1,
			},
		});

		await service.remove(conversation.id, userId);

		expect(
			await db.agentConversation.findUnique({ where: { id: conversation.id } }),
		).toBeNull();
		expect(
			await db.agentEvent.count({
				where: { sessionId },
			}),
		).toBe(0);
		expect(
			await db.agentBuilderArtifact.count({
				where: { conversationId: conversation.id },
			}),
		).toBe(0);
	});

	it("will not let one rep delete another's conversation", async () => {
		const conversation = await file(`ses_${suffix}_protected`, { contactId });

		let removeError: unknown;
		try {
			await service.remove(conversation.id, "somebody-else");
		} catch (error) {
			removeError = error;
		}
		expect(removeError).toBeDefined();
		expect(
			await db.agentConversation.findUnique({ where: { id: conversation.id } }),
		).not.toBeNull();
	});

	it("persists the command type that controls agent creation", async () => {
		const chat = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CHAT",
				message: "Tell me about this customer",
				resources: [],
				attachments: [],
			},
			userId,
		);
		const creation = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CREATE_AGENT",
				message: "/Create agent Flag stalled deals",
				resources: [],
				attachments: [],
			},
			userId,
		);

		expect(
			(await service.builderById(chat.id, userId)).submissions[0],
		).toMatchObject({ commandType: "CHAT" });
		expect(
			(await service.builderById(creation.id, userId)).submissions[0],
		).toMatchObject({ commandType: "CREATE_AGENT" });
		expect((await service.builderById(chat.id, userId)).title).toBeNull();
		expect((await service.builderById(creation.id, userId)).title).toBeNull();
	});

	it("persists attachment bytes once and returns lightweight transcript metadata", async () => {
		const imageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
		const textBytes = Buffer.from("account notes");
		const input = {
			clientRequestId: crypto.randomUUID(),
			commandType: "CHAT" as const,
			message: "Review these files",
			resources: [],
			attachments: [
				{
					name: "account.png",
					type: "image/png",
					size: imageBytes.byteLength,
					contentBase64: imageBytes.toString("base64"),
				},
				{
					name: "notes.txt",
					type: "text/plain",
					size: textBytes.byteLength,
					contentBase64: textBytes.toString("base64"),
				},
			],
		};
		const conversation = await service.createBuilder(input, userId);
		const detail = await service.builderById(conversation.id, userId);
		const submission = detail.submissions.find(
			(row) => row.clientRequestId === input.clientRequestId,
		);
		const message = recordOf(submission?.message);
		const attachments = arrayOf(message.attachments).map(recordOf);

		expect(JSON.stringify(message)).not.toContain("contentBase64");
		expect(attachments).toEqual([
			expect.objectContaining({
				name: "account.png",
				type: "image/png",
				size: imageBytes.byteLength,
				previewUrl: expect.stringContaining("/api/conversations/attachments/"),
			}),
			expect.objectContaining({
				name: "notes.txt",
				type: "text/plain",
				size: textBytes.byteLength,
				previewUrl: null,
			}),
		]);
		const imageId = attachments[0]?.id;
		if (typeof imageId !== "string") throw new Error("Missing attachment id");
		const image = await service.attachment(imageId, userId);
		expect(Buffer.from(image.content)).toEqual(imageBytes);
		expect(image).toMatchObject({
			name: "account.png",
			mediaType: "image/png",
			previewable: true,
		});
	});

	it("rejects attachment metadata that does not match its bytes", () => {
		expect(
			builderConversationCreateInput.safeParse({
				clientRequestId: crypto.randomUUID(),
				message: "Review this file",
				attachments: [
					{
						name: "notes.txt",
						type: "text/plain",
						size: 99,
						contentBase64: Buffer.from("notes").toString("base64"),
					},
				],
			}).success,
		).toBe(false);
	});

	it("reuses persisted attachment bytes when retrying a failed agent turn", async () => {
		const bytes = Buffer.from("retry-safe attachment");
		const conversation = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CHAT",
				message: "Read this attachment",
				resources: [],
				attachments: [
					{
						name: "retry.txt",
						type: "text/plain",
						size: bytes.byteLength,
						contentBase64: bytes.toString("base64"),
					},
				],
			},
			userId,
		);
		const original = await service.builderById(conversation.id, userId);
		const originalMessage = recordOf(original.submissions[0]?.message);
		const originalAttachment = recordOf(
			arrayOf(originalMessage.attachments)[0],
		);

		await service.submitBuilder(
			{
				id: conversation.id,
				clientRequestId: crypto.randomUUID(),
				commandType: "CHAT",
				message: "Try reading it again",
				resources: [],
				attachments: [
					{
						id: String(originalAttachment.id),
						name: String(originalAttachment.name),
						type: String(originalAttachment.type),
						size: Number(originalAttachment.size),
						previewUrl: null,
					},
				],
			},
			userId,
		);

		const detail = await service.builderById(conversation.id, userId);
		const retryMessage = recordOf(detail.submissions.at(-1)?.message);
		const retryAttachment = recordOf(arrayOf(retryMessage.attachments)[0]);
		expect(retryAttachment.id).not.toBe(originalAttachment.id);
		const stored = await service.attachment(String(retryAttachment.id), userId);
		expect(Buffer.from(stored.content)).toEqual(bytes);
	});

	it("does not copy an attachment from another private conversation", async () => {
		const bytes = Buffer.from("private attachment");
		const source = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CHAT",
				message: "Private source",
				resources: [],
				attachments: [
					{
						name: "private.txt",
						type: "text/plain",
						size: bytes.byteLength,
						contentBase64: bytes.toString("base64"),
					},
				],
			},
			userId,
		);
		const target = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CHAT",
				message: "Different private chat",
				resources: [],
				attachments: [],
			},
			userId,
		);
		const sourceDetail = await service.builderById(source.id, userId);
		const sourceMessage = recordOf(sourceDetail.submissions[0]?.message);
		const attachment = recordOf(arrayOf(sourceMessage.attachments)[0]);

		let submitError: unknown;
		try {
			await service.submitBuilder(
				{
					id: target.id,
					clientRequestId: crypto.randomUUID(),
					commandType: "CHAT",
					message: "Copy data across chats",
					resources: [],
					attachments: [
						{
							id: String(attachment.id),
							name: String(attachment.name),
							type: String(attachment.type),
							size: Number(attachment.size),
							previewUrl: null,
						},
					],
				},
				userId,
			);
		} catch (error) {
			submitError = error;
		}
		expect(submitError).toBeInstanceOf(Error);
		expect((submitError as Error).message).toContain("no longer available");
	});

	it("deduplicates concurrent builder creation retries", async () => {
		const clientRequestId = crypto.randomUUID();
		const results = await Promise.all(
			Array.from({ length: 4 }, () =>
				service.createBuilder(
					{
						clientRequestId,
						commandType: "CHAT",
						message: "Prepare a renewal brief",
						resources: [],
						attachments: [],
					},
					userId,
				),
			),
		);

		expect(new Set(results.map((result) => result.id)).size).toBe(1);
		expect(
			await db.agentConversationSubmission.count({
				where: { clientRequestId },
			}),
		).toBe(1);
	});

	it("deduplicates concurrent builder message retries", async () => {
		const conversation = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CHAT",
				message: "Review the account history",
				resources: [],
				attachments: [],
			},
			userId,
		);
		const clientRequestId = crypto.randomUUID();
		const results = await Promise.all(
			Array.from({ length: 4 }, () =>
				service.submitBuilder(
					{
						id: conversation.id,
						clientRequestId,
						commandType: "CHAT",
						message: "Summarize the open risks",
						resources: [],
						attachments: [],
					},
					userId,
				),
			),
		);

		expect(new Set(results.map((result) => result.id)).size).toBe(1);
		expect(
			await db.agentConversationSubmission.count({
				where: { clientRequestId },
			}),
		).toBe(1);
	});

	it("queues a pending builder answer for the CRM-owned Eve channel", async () => {
		const conversation = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CREATE_AGENT",
				message: "/Create agent Flag overdue invoices",
				resources: [],
				attachments: [],
			},
			userId,
		);
		const sessionId = `builder-question-${suffix}-1`;
		await db.agentConversation.update({
			where: { id: conversation.id },
			data: {
				sessionId,
				continuationToken: `crm:builder:${conversation.id}`,
				pendingInputRequest: {
					kind: "question",
					requestId: "question-1",
					prompt: "Where should this go?",
					display: "select",
					options: [{ id: "crm-task", label: "Create a CRM task" }],
				},
			},
		});

		expect(
			(await service.builderById(conversation.id, userId)).pendingQuestion,
		).toMatchObject({
			requestId: "question-1",
			prompt: "Where should this go?",
		});

		const response = await service.answerBuilderQuestion(
			{
				id: conversation.id,
				clientRequestId: crypto.randomUUID(),
				requestId: "question-1",
				optionId: "crm-task",
			},
			userId,
		);
		const submission = await db.agentConversationSubmission.findUnique({
			where: { id: response.id },
			select: {
				commandType: true,
				inputRequestId: true,
				message: true,
				status: true,
			},
		});

		expect(submission).toMatchObject({
			commandType: "CREATE_AGENT",
			inputRequestId: "question-1",
			status: "PENDING",
			message: {
				text: "Create a CRM task",
				inputResponse: {
					requestId: "question-1",
					optionId: "crm-task",
				},
			},
		});
	});

	it("rejects an answer when the conversation has no durable question", async () => {
		const conversation = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CREATE_AGENT",
				message: "/Create agent Notify the team",
				resources: [],
				attachments: [],
			},
			userId,
		);
		await db.agentConversation.update({
			where: { id: conversation.id },
			data: {
				sessionId: `builder-question-${suffix}-recovery`,
				continuationToken: `builder:${conversation.id}`,
			},
		});

		let error: Error | null = null;
		try {
			await service.answerBuilderQuestion(
				{
					id: conversation.id,
					clientRequestId: crypto.randomUUID(),
					requestId: "question-only-in-eve",
					optionId: "continue-building",
				},
				userId,
			);
		} catch (caught) {
			error = caught as Error;
		}
		expect(error?.message).toBe(
			"The agent is no longer waiting for that answer.",
		);
	});

	it("accepts only one concurrent answer to a follow-up request", async () => {
		const conversation = await service.createBuilder(
			{
				clientRequestId: crypto.randomUUID(),
				commandType: "CREATE_AGENT",
				message: "/Create agent Prepare meeting briefs",
				resources: [],
				attachments: [],
			},
			userId,
		);
		const sessionId = `builder-question-${suffix}-2`;
		await db.agentConversation.update({
			where: { id: conversation.id },
			data: {
				sessionId,
				continuationToken: `crm:builder:${conversation.id}`,
				pendingInputRequest: {
					kind: "question",
					requestId: "question-concurrent",
					prompt: "Which output?",
					display: "select",
					options: [
						{ id: "note", label: "Create a note" },
						{ id: "task", label: "Create a task" },
					],
				},
			},
		});

		const results = await Promise.allSettled([
			service.answerBuilderQuestion(
				{
					id: conversation.id,
					clientRequestId: crypto.randomUUID(),
					requestId: "question-concurrent",
					optionId: "note",
				},
				userId,
			),
			service.answerBuilderQuestion(
				{
					id: conversation.id,
					clientRequestId: crypto.randomUUID(),
					requestId: "question-concurrent",
					optionId: "task",
				},
				userId,
			),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		expect(
			await db.agentConversationSubmission.count({
				where: {
					conversationId: conversation.id,
					inputRequestId: "question-concurrent",
				},
			}),
		).toBe(1);
	});
});

function recordOf(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function arrayOf(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}
