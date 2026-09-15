import { db } from "@crm/db";
import type { AccessArea } from "@crm/db/access-config";
import { moneyRefusalMessage } from "@crm/db/access-money";
import {
	type AccessNeed,
	type AccessPrincipal,
	adminPrincipal,
	allows,
	hasMoney,
	refusalMessage,
} from "@crm/db/access-policy";
import { resolvePrincipal } from "@crm/db/access-resolve";
import {
	contactScopeWhere,
	dealChildWhere,
	dealScopeWhere,
	requiredDealChildWhere,
} from "@crm/db/access-scope";
import type { z } from "zod";
import { isAutomated, type WriteGuard } from "./approval";
import { parseDrawingCheckPayload } from "./drawing-check-payload";
import { purposeOf } from "./session-purpose";

export const AGENT_ACCESS = {
	automationPrincipalId: "janus-automation",
	notMember: "This person is not a member of this workspace.",
	missingUser: "This session is missing userId.",
	adminOnlyFields: "Only a workspace admin can change custom fields.",
	noCheckRequester: "This check has no requesting user.",
	teamAgent: {
		userAuthenticator: "crm-user",
		scheduleAuthenticator: "crm-schedule",
		unknownCaller: "This deployed-agent run has an unrecognised caller.",
		userMismatch: "This deployed-agent run names a different user.",
	},
	notFound: {
		contact: "No such contact.",
		deal: "No such deal.",
		drawing: "No such drawing.",
		estimate: "No such estimate.",
		permit: "No such permit.",
	},
} as const;

type Attributes = Readonly<Record<string, unknown>>;

export type AccessContext = {
	readonly session: {
		readonly auth: {
			readonly current: {
				readonly authenticator?: string;
				readonly principalId?: string;
				readonly principalType?: string;
				readonly attributes: Attributes;
			} | null;
			readonly initiator: { readonly attributes: Attributes } | null;
		};
	};
};

export type Refusal = { refused: string };

export async function sessionPrincipal(
	ctx: AccessContext,
): Promise<AccessPrincipal> {
	const current = ctx.session.auth.current;

	if (isAutomated(ctx.session)) {
		const requester = await automationRequester(ctx);
		return requester
			? memberPrincipal(requester)
			: adminPrincipal(AGENT_ACCESS.automationPrincipalId);
	}

	if (purposeOf(ctx) === "team-agent") {
		return memberPrincipal(teamAgentUser(current));
	}

	if (current?.principalType !== "user" || !current.principalId) {
		throw new Error(AGENT_ACCESS.missingUser);
	}
	return memberPrincipal(current.principalId);
}

function currentAttribute(
	current: AccessContext["session"]["auth"]["current"],
	key: string,
): string | null {
	const value = current?.attributes[key];
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function teamAgentUser(
	current: AccessContext["session"]["auth"]["current"],
): string {
	const authenticator = current?.authenticator;
	if (
		authenticator !== AGENT_ACCESS.teamAgent.userAuthenticator &&
		authenticator !== AGENT_ACCESS.teamAgent.scheduleAuthenticator
	) {
		throw new Error(AGENT_ACCESS.teamAgent.unknownCaller);
	}
	const userId = currentAttribute(current, "userId");
	if (!userId) throw new Error(AGENT_ACCESS.missingUser);
	if (
		authenticator === AGENT_ACCESS.teamAgent.userAuthenticator &&
		userId !== current?.principalId
	) {
		throw new Error(AGENT_ACCESS.teamAgent.userMismatch);
	}
	return userId;
}

async function automationRequester(ctx: AccessContext): Promise<string | null> {
	const current = ctx.session.auth.current;
	const requestedById = currentAttribute(current, "requestedById");
	if (requestedById) return requestedById;
	if (currentAttribute(current, "taskKind") !== "drawing-check") return null;

	const parsed = parseDrawingCheckPayload({
		estimateId: currentAttribute(current, "estimateId"),
	});
	const estimate = parsed
		? await db.estimate.findUnique({
				where: { id: parsed.estimateId },
				select: { createdById: true },
			})
		: null;
	if (!estimate?.createdById) throw new Error(AGENT_ACCESS.noCheckRequester);
	return estimate.createdById;
}

async function memberPrincipal(userId: string): Promise<AccessPrincipal> {
	const p = await resolvePrincipal(db, userId);
	if (!p) throw new Error(AGENT_ACCESS.notMember);
	return p;
}

export function refusal(
	p: AccessPrincipal,
	area: AccessArea,
	need: AccessNeed,
): Refusal | null {
	return allows(p, area, need)
		? null
		: { refused: refusalMessage(p, area, need) };
}

export function priceBookRefusal(p: AccessPrincipal): Refusal | null {
	return hasMoney(p, "priceBook")
		? null
		: { refused: moneyRefusalMessage(p, "edit the price book.") };
}

export type AccessTargetKind = keyof typeof AGENT_ACCESS.notFound;

export type AccessTarget = {
	kind: AccessTargetKind;
	id: string;
	need?: AccessNeed;
};

const TARGET_AREA: Record<AccessTargetKind, AccessArea> = {
	contact: "contacts",
	deal: "deals",
	drawing: "drawings",
	estimate: "estimates",
	permit: "permits",
};

export async function targetsBlocked(
	p: AccessPrincipal,
	targets: readonly AccessTarget[],
): Promise<string | null> {
	for (const target of targets) {
		const area = TARGET_AREA[target.kind];
		const denied = refusal(p, area, target.need ?? "VIEW");
		if (denied) return denied.refused;
		if (!(await inScope(p, target))) return AGENT_ACCESS.notFound[target.kind];
	}
	return null;
}

async function inScope(
	p: AccessPrincipal,
	target: AccessTarget,
): Promise<boolean> {
	const select = { id: true } as const;
	switch (target.kind) {
		case "contact":
			return (
				(await db.contact.findFirst({
					where: { AND: [{ id: target.id }, contactScopeWhere(p)] },
					select,
				})) !== null
			);
		case "deal":
			return (
				(await db.deal.findFirst({
					where: { AND: [{ id: target.id }, dealScopeWhere(p)] },
					select,
				})) !== null
			);
		case "drawing":
			return (
				(await db.drawing.findFirst({
					where: { AND: [{ id: target.id }, dealChildWhere(p)] },
					select,
				})) !== null
			);
		case "estimate":
			return (
				(await db.estimate.findFirst({
					where: { AND: [{ id: target.id }, dealChildWhere(p)] },
					select,
				})) !== null
			);
		case "permit":
			return (
				(await db.permit.findFirst({
					where: { AND: [{ id: target.id }, requiredDealChildWhere(p)] },
					select,
				})) !== null
			);
	}
}

export function writeGuard<T>(
	schema: z.ZodType<T>,
	check: (p: AccessPrincipal, input: T) => Promise<string | null>,
): WriteGuard {
	return async (session, toolInput) => {
		const parsed = schema.safeParse(toolInput);
		if (!parsed.success) return null;
		return check(await sessionPrincipal({ session }), parsed.data);
	};
}
