import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	type AccessFixture,
	createAccessFixture,
} from "@crm/db/access-fixture";
import type { AccessPrincipal } from "@crm/db/access-policy";
import { sessionPrincipal } from "../agent/lib/access";
import { readDealHistory } from "../agent/lib/accounts";
import { contactsNeedingWork, readCrmHistory } from "../agent/lib/crm";
import { listDrawings } from "../agent/lib/drawing-lookup";
import { loadDrawingSummary } from "../agent/lib/drawing-summary";
import { loadEstimateSummary } from "../agent/lib/estimate-summary";
import { listDeals, searchCrm } from "../agent/lib/lookup";
import {
	contactPreamble,
	dealPreamble,
	drawingPreamble,
} from "../agent/lib/preamble";
import { listPriceBook } from "../agent/lib/price-book";
import attachDrawingTool from "../agent/tools/attach_drawing";
import fillWorksheetTool from "../agent/tools/fill_worksheet";
import proposeEstimateLinesTool from "../agent/tools/propose_estimate_lines";
import readEstimateTool from "../agent/tools/read_estimate";
import readPermitTool from "../agent/tools/read_permit";
import searchCrmTool from "../agent/tools/search_crm";
import setFieldValueTool from "../agent/tools/set_field_value";
import updateServiceTool from "../agent/tools/update_service";

const suffix = `${process.env.TEST_RUN_ID ?? "local"}-agent-access`;

let f: AccessFixture;

beforeAll(async () => {
	f = await createAccessFixture(suffix);
});

afterAll(async () => {
	await f.cleanup();
});

function withoutPrices(p: AccessPrincipal): AccessPrincipal {
	return { ...p, policy: { ...p.policy, money: [] } };
}

function userCtx(userId: string, attributes: Record<string, string> = {}) {
	return {
		callId: "call-access",
		session: {
			auth: {
				current: {
					authenticator: "crm-app",
					principalId: userId,
					principalType: "user",
					attributes,
				},
				initiator: null,
			},
		},
	};
}

function automatedCtx(attributes: Record<string, string> = {}) {
	return {
		callId: "call-access",
		session: {
			auth: {
				current: {
					authenticator: "app",
					principalId: "eve:app",
					principalType: "runtime",
					attributes,
				},
				initiator: null,
			},
		},
	};
}

async function run(
	tool: { execute?: unknown },
	input: Record<string, unknown>,
	ctx: unknown,
) {
	const execute = tool.execute as (i: unknown, c: unknown) => Promise<unknown>;
	return execute(input, ctx);
}

describe("sessionPrincipal", () => {
	test("a bridge user session resolves to that member's group", async () => {
		const p = await sessionPrincipal(userCtx(f.clerkId));
		expect(p.groupName).toBe("Sales clerk");
		expect(p.isAdmin).toBe(false);
	});

	test("a user who is not a member is refused", async () => {
		await expect(sessionPrincipal(userCtx("nobody-here"))).rejects.toThrow(
			"This person is not a member of this workspace.",
		);
	});

	test("a system-initiated automated session runs as the automation admin", async () => {
		const p = await sessionPrincipal(automatedCtx({ taskKind: "identify" }));
		expect(p).toMatchObject({ userId: "janus-automation", isAdmin: true });
	});

	test("a drawing check runs as the person whose estimate triggered it", async () => {
		const p = await sessionPrincipal(
			automatedCtx({
				taskKind: "drawing-check",
				estimateId: f.clerkEstimateId,
			}),
		);
		expect(p.userId).toBe(f.clerkId);
		expect(p.isAdmin).toBe(false);
	});

	test("a scheduled team-agent run runs as the agent's creator, never as admin", async () => {
		const p = await sessionPrincipal({
			session: {
				auth: {
					current: {
						authenticator: "crm-schedule",
						principalId: f.clerkId,
						principalType: "runtime",
						attributes: {
							purpose: "team-agent",
							runId: "run-1",
							userId: f.clerkId,
						},
					},
					initiator: null,
				},
			},
		});
		expect(p.userId).toBe(f.clerkId);
		expect(p.isAdmin).toBe(false);
	});

	test("a session with no person on it is refused", async () => {
		await expect(
			sessionPrincipal({
				session: {
					auth: {
						current: {
							authenticator: "local-dev",
							principalId: "local-dev",
							principalType: "local-dev",
							attributes: {},
						},
						initiator: null,
					},
				},
			}),
		).rejects.toThrow("This session is missing userId.");
	});
});

describe("agent reads are scoped to the caller", () => {
	test("list_deals for a clerk returns only their deals", async () => {
		const result = await listDeals({ status: "all", limit: 100 }, f.clerk);
		const ids = result.deals.map((row) => row.id);
		expect(ids).toContain(f.clerkDealId);
		expect(ids).not.toContain(f.otherDealId);
	});

	test("list_deals hides amounts without the prices switch", async () => {
		await db.deal.update({
			where: { id: f.clerkDealId },
			data: { amount: 12_345 },
		});
		const result = await listDeals(
			{ status: "all", limit: 100 },
			withoutPrices(f.clerk),
		);
		const mine = result.deals.find((row) => row.id === f.clerkDealId);
		expect(mine?.amount).toBeNull();
	});

	test("search_crm leaves out records outside the clerk's scope", async () => {
		const result = await searchCrm(suffix, { limit: 25 }, f.clerk);
		const ids = [...result.contacts, ...result.deals].map((row) => row.id);
		expect(ids).toContain(f.clerkDealId);
		expect(ids).toContain(f.clerkContactId);
		expect(ids).not.toContain(f.otherDealId);
		expect(ids).not.toContain(f.otherContactId);
		const admin = await searchCrm(suffix, { limit: 25 }, f.admin);
		const adminIds = [...admin.contacts, ...admin.deals].map((row) => row.id);
		expect(adminIds).toContain(f.otherDealId);
		expect(adminIds).toContain(f.otherContactId);
	});

	test("search_crm skips areas the group cannot view", async () => {
		const result = await searchCrm(suffix, { limit: 25 }, f.crew);
		expect(result.total).toBe(0);
		const partial = await searchCrm(
			suffix,
			{ limit: 25 },
			hiding(f.clerk, "deals"),
		);
		expect(partial.deals).toEqual([]);
		expect(partial.contacts.map((row) => row.id)).toContain(f.clerkContactId);
	});

	test("estimate summary is not found outside scope", async () => {
		const result = await loadEstimateSummary(f.otherEstimateId, f.clerk);
		expect(result).toEqual({ found: false, reason: "No such estimate." });
	});

	test("estimate summary hides prices without the switch", async () => {
		const summary = await loadEstimateSummary(
			f.clerkEstimateId,
			withoutPrices(f.clerk),
		);
		expect(summary.found).toBe(true);
		expect(JSON.stringify(summary)).not.toMatch(/Cents":\s*\d/);
	});

	test("estimate summary keeps prices with the switch", async () => {
		const summary = await loadEstimateSummary(f.clerkEstimateId, f.clerk);
		expect(JSON.stringify(summary)).toMatch(/priceGoodCents":5000/);
	});

	test("drawings list and read stay inside scope", async () => {
		const listed = await listDrawings({ query: suffix, limit: 100 }, f.clerk);
		const ids = listed.drawings.map((row) => row.id);
		expect(ids).toContain(f.clerkDrawingId);
		expect(ids).toContain(f.looseDrawingByClerkId);
		expect(ids).not.toContain(f.otherDrawingId);
		expect(ids).not.toContain(f.looseDrawingByAdminId);
		expect(await loadDrawingSummary(f.otherDrawingId, f.clerk)).toEqual({
			found: false,
			reason: "No such drawing.",
		});
	});

	test("contact and deal history are not found outside scope", async () => {
		expect(await readCrmHistory(f.otherContactId, {}, f.clerk)).toBeNull();
		expect(await readDealHistory(f.otherDealId, {}, f.clerk)).toBeNull();
		expect(await readCrmHistory(f.clerkContactId, {}, f.clerk)).not.toBeNull();
		expect(await readDealHistory(f.clerkDealId, {}, f.clerk)).not.toBeNull();
	});

	test("outstanding work lists only in-scope contacts", async () => {
		const rows = await contactsNeedingWork(500, f.clerk);
		const ids = rows.map((row) => row.id);
		expect(ids).toContain(f.clerkContactId);
		expect(ids).not.toContain(f.otherContactId);
		const all = await contactsNeedingWork(1_000_000, f.admin);
		expect(all.map((row) => row.id)).toContain(f.otherContactId);
	});

	test("price book hides prices without the switch", async () => {
		const service = await db.service.create({
			data: {
				name: `Access service ${suffix}`,
				unit: "PER_SQUARE",
				unitPriceCents: 900,
				trade: `access-${suffix}`,
			},
			select: { id: true },
		});
		try {
			const [row] = await listPriceBook(
				`access-${suffix}`,
				withoutPrices(f.clerk),
			);
			expect(row?.unitPriceCents).toBeNull();
		} finally {
			await db.service.delete({ where: { id: service.id } });
		}
	});
});

describe("agent tools refuse what the group cannot do", () => {
	test("read_permit refuses a group without permits", async () => {
		const result = await run(
			readPermitTool,
			{ permitId: f.clerkPermitId },
			userCtx(f.clerkId),
		);
		expect(result).toEqual({
			refused: "Your group (Sales clerk) can't view permits. Ask an admin.",
		});
	});

	test("read_estimate on another rep's estimate is not found", async () => {
		const result = await run(
			readEstimateTool,
			{ estimateId: f.otherEstimateId },
			userCtx(f.clerkId),
		);
		expect(result).toEqual({ found: false, reason: "No such estimate." });
	});

	test("search_crm tool scopes by the session's person", async () => {
		const result = (await run(
			searchCrmTool,
			{ query: suffix, limit: 25 },
			userCtx(f.clerkId),
		)) as { deals: { id: string }[] };
		expect(result.deals.map((row) => row.id)).not.toContain(f.otherDealId);
	});

	test("attach_drawing refuses a drawing outside scope", async () => {
		const result = await run(
			attachDrawingTool,
			{ drawingId: f.otherDrawingId, dealId: f.clerkDealId },
			userCtx(f.clerkId),
		);
		expect(result).toEqual({ attached: false, reason: "No such drawing." });
	});

	test("attach_drawing refuses a target deal outside scope", async () => {
		const result = await run(
			attachDrawingTool,
			{ drawingId: f.clerkDrawingId, dealId: f.otherDealId },
			userCtx(f.clerkId),
		);
		expect(result).toEqual({ attached: false, reason: "No such deal." });
	});

	test("set_field_value refuses a record outside scope", async () => {
		const result = await run(
			setFieldValueTool,
			{
				entity: "DEAL",
				recordId: f.otherDealId,
				key: "anything",
				value: "x",
			},
			userCtx(f.clerkId),
		);
		expect(result).toEqual({ written: false, reason: "No such deal." });
	});

	test("update_service refuses without the price book switch", async () => {
		const result = await run(
			updateServiceTool,
			{
				serviceId: "cmaaaaaaaaaaaaaaaaaaaaaaa",
				current: {
					name: "x",
					unitPriceCents: 1,
					priceGoodCents: null,
					priceBestCents: null,
					modifier: null,
				},
				changes: { unitPriceCents: 2 },
			},
			userCtx(f.clerkId),
		);
		expect(result).toEqual({
			refused:
				"Your group (Sales clerk) can't edit the price book. Ask an admin.",
		});
	});
});

function hiding(
	p: AccessPrincipal,
	...areas: (keyof AccessPrincipal["policy"]["areas"])[]
): AccessPrincipal {
	const next = { ...p.policy.areas };
	for (const area of areas) next[area] = "HIDDEN";
	return { ...p, policy: { ...p.policy, areas: next } };
}

describe("session preambles stay inside the caller's access", () => {
	test("a deal preamble hides the amount without the prices switch", async () => {
		await db.deal.update({
			where: { id: f.clerkDealId },
			data: { amount: 54_321 },
		});
		const hidden = await dealPreamble(
			f.clerkDealId,
			{ dispatched: false },
			withoutPrices(f.clerk),
		);
		const shown = await dealPreamble(
			f.clerkDealId,
			{ dispatched: false },
			f.admin,
		);
		expect(hidden.markdown).toContain(f.clerkDealId);
		expect(hidden.markdown).not.toContain("54321");
		expect(hidden.markdown).not.toContain("Amount:");
		expect(shown.markdown).toContain("Amount: 54321");
	});

	test("a deal preamble outside scope names nothing", async () => {
		const outside = await dealPreamble(
			f.otherDealId,
			{ dispatched: false },
			f.clerk,
		);
		const admin = await dealPreamble(
			f.otherDealId,
			{ dispatched: false },
			f.admin,
		);
		expect(outside.markdown).not.toContain(f.otherDealId);
		expect(admin.markdown).toContain(f.otherDealId);
	});

	test("a contact preamble lists only deals the caller can see", async () => {
		await db.dealContact.create({
			data: { dealId: f.otherDealId, contactId: f.clerkContactId },
		});
		try {
			const clerk = await contactPreamble(
				f.clerkContactId,
				{ dispatched: false },
				f.clerk,
			);
			const noDeals = await contactPreamble(
				f.clerkContactId,
				{ dispatched: false },
				hiding(f.clerk, "deals"),
			);
			const admin = await contactPreamble(
				f.clerkContactId,
				{ dispatched: false },
				f.admin,
			);
			expect(clerk.markdown).toContain(f.clerkDealId);
			expect(clerk.markdown).not.toContain(f.otherDealId);
			expect(noDeals.markdown).not.toContain(f.clerkDealId);
			expect(admin.markdown).toContain(f.clerkDealId);
			expect(admin.markdown).toContain(f.otherDealId);
		} finally {
			await db.dealContact.delete({
				where: {
					dealId_contactId: {
						dealId: f.otherDealId,
						contactId: f.clerkContactId,
					},
				},
			});
		}
	});

	test("a drawing preamble and summary omit contact and estimate without their areas", async () => {
		await db.drawing.update({
			where: { id: f.clerkDrawingId },
			data: {
				contactId: f.clerkContactId,
				scene: {
					excalidraw: { elements: [], appState: {}, files: {} },
					satellite: null,
				},
			},
		});
		await db.estimate.update({
			where: { id: f.clerkEstimateId },
			data: { drawingId: f.clerkDrawingId },
		});
		try {
			const hidden = await drawingPreamble(
				f.clerkDrawingId,
				{ dispatched: false },
				hiding(f.clerk, "contacts", "estimates"),
			);
			const admin = await drawingPreamble(
				f.clerkDrawingId,
				{ dispatched: false },
				f.admin,
			);
			expect(hidden.markdown).toContain(f.clerkDrawingId);
			expect(hidden.markdown).not.toContain(f.clerkContactId);
			expect(hidden.markdown).not.toContain(f.clerkEstimateId);
			expect(admin.markdown).toContain(f.clerkContactId);
			expect(admin.markdown).toContain(f.clerkEstimateId);

			const summary = await loadDrawingSummary(
				f.clerkDrawingId,
				hiding(f.clerk, "contacts"),
			);
			const adminSummary = await loadDrawingSummary(f.clerkDrawingId, f.admin);
			if (!summary.found || !adminSummary.found) {
				throw new Error("expected both drawing summaries");
			}
			expect(summary.contact).toBeNull();
			expect(adminSummary.contact?.id).toBe(f.clerkContactId);
		} finally {
			await db.estimate.update({
				where: { id: f.clerkEstimateId },
				data: { drawingId: null },
			});
			await db.drawing.update({
				where: { id: f.clerkDrawingId },
				data: { contactId: null },
			});
		}
	});
});

describe("unattended and deployed sessions resolve the right person", () => {
	test("a permit-research task runs as the rep who moved the deal", async () => {
		const p = await sessionPrincipal(
			automatedCtx({ taskKind: "permit-research", requestedById: f.clerkId }),
		);
		expect(p.userId).toBe(f.clerkId);
		expect(p.isAdmin).toBe(false);
	});

	test("a permit-research task with no requester runs as automation", async () => {
		const p = await sessionPrincipal(
			automatedCtx({ taskKind: "permit-research" }),
		);
		expect(p).toMatchObject({ userId: "janus-automation", isAdmin: true });
	});

	test("a drawing check without a readable estimate is refused", async () => {
		await expect(
			sessionPrincipal(
				automatedCtx({
					taskKind: "drawing-check",
					estimateId: "cmaaaaaaaaaaaaaaaaaaaaaaa",
				}),
			),
		).rejects.toThrow("This check has no requesting user.");
	});

	function teamAgentCtx(
		authenticator: string,
		principalId: string,
		attributes: Record<string, string>,
		initiatorAttributes: Record<string, string> = {},
	) {
		return {
			session: {
				auth: {
					current: {
						authenticator,
						principalId,
						principalType: "user",
						attributes: { purpose: "team-agent", ...attributes },
					},
					initiator: { attributes: initiatorAttributes },
				},
			},
		};
	}

	test("a manual team-agent run runs as its initiator", async () => {
		const p = await sessionPrincipal(
			teamAgentCtx("crm-user", f.clerkId, { userId: f.clerkId }),
		);
		expect(p.userId).toBe(f.clerkId);
	});

	test("a team-agent run with an unknown authenticator is refused", async () => {
		await expect(
			sessionPrincipal(
				teamAgentCtx("crm-app", f.clerkId, { userId: f.clerkId }),
			),
		).rejects.toThrow("This deployed-agent run has an unrecognised caller.");
	});

	test("a manual team-agent run naming another user is refused", async () => {
		await expect(
			sessionPrincipal(
				teamAgentCtx("crm-user", f.clerkId, { userId: f.adminId }),
			),
		).rejects.toThrow("This deployed-agent run names a different user.");
	});

	test("a team-agent userId only on the initiator is not trusted", async () => {
		await expect(
			sessionPrincipal(
				teamAgentCtx("crm-schedule", f.clerkId, {}, { userId: f.adminId }),
			),
		).rejects.toThrow("This session is missing userId.");
	});
});

describe("approval-gated writes refuse before the card", () => {
	function approvalCall(session: unknown, toolInput: unknown) {
		return {
			session,
			toolName: "tool",
			toolInput,
			approvedTools: [],
			callId: "call-access",
		} as never;
	}

	function estimateInput(estimateId: string) {
		return {
			estimateId,
			estimateTitle: "Roof",
			lines: [
				{
					name: "Ridge vent",
					unit: "PER_EACH",
					quantity: 1,
					reason: "Missing from the takeoff.",
					source: "missing",
				},
			],
		};
	}

	test("propose_estimate_lines denies a clerk an estimate outside scope", async () => {
		const approval = proposeEstimateLinesTool.approval as (
			c: never,
		) => Promise<unknown>;
		const clerk = userCtx(f.clerkId).session;
		const admin = userCtx(f.adminId).session;
		expect(
			await approval(approvalCall(clerk, estimateInput(f.otherEstimateId))),
		).toEqual({ type: "denied", reason: "No such estimate." });
		expect(
			await approval(approvalCall(clerk, estimateInput(f.clerkEstimateId))),
		).toBe("user-approval");
		expect(
			await approval(approvalCall(admin, estimateInput(f.otherEstimateId))),
		).toBe("user-approval");
	});

	test("update_service denies a clerk without the price book switch", async () => {
		const approval = updateServiceTool.approval as (
			c: never,
		) => Promise<unknown>;
		const input = {
			serviceId: "cmaaaaaaaaaaaaaaaaaaaaaaa",
			current: {
				name: "x",
				unitPriceCents: 1,
				priceGoodCents: null,
				priceBestCents: null,
				modifier: null,
			},
			changes: { unitPriceCents: 2 },
		};
		expect(
			await approval(approvalCall(userCtx(f.clerkId).session, input)),
		).toEqual({
			type: "denied",
			reason:
				"Your group (Sales clerk) can't edit the price book. Ask an admin.",
		});
		expect(
			await approval(approvalCall(userCtx(f.adminId).session, input)),
		).toBe("user-approval");
	});

	test("fill_worksheet denies a clerk whose group has no permits", async () => {
		const approval = fillWorksheetTool.approval as (
			c: never,
		) => Promise<unknown>;
		const input = { permitId: f.clerkPermitId, answers: {} };
		expect(
			await approval(approvalCall(userCtx(f.clerkId).session, input)),
		).toEqual({
			type: "denied",
			reason: "Your group (Sales clerk) can't edit permits. Ask an admin.",
		});
		expect(
			await approval(approvalCall(userCtx(f.adminId).session, input)),
		).toBe("user-approval");
	});
});
