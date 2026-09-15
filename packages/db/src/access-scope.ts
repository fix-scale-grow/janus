import type { AccessPrincipal } from "./access-policy";
import type { Prisma } from "./generated/prisma/client";

export function isUnscoped(p: AccessPrincipal): boolean {
	return p.isAdmin || p.scope === "ALL";
}

export function dealScopeWhere(p: AccessPrincipal): Prisma.DealWhereInput {
	if (isUnscoped(p)) return {};
	if (p.scope === "OWN") return { OR: [{ ownerId: p.userId }] };
	return { id: { in: [] } };
}

export type DealChildWhere =
	| Record<string, never>
	| { deal: Prisma.DealWhereInput }
	| {
			OR: [
				{ deal: Prisma.DealWhereInput },
				{ dealId: null; createdById: string },
			];
	  };

export function dealChildWhere(p: AccessPrincipal): DealChildWhere {
	if (isUnscoped(p)) return {};
	const deal = dealScopeWhere(p);
	if (p.scope === "OWN")
		return { OR: [{ deal }, { dealId: null, createdById: p.userId }] };
	return { deal };
}

export function requiredDealChildWhere(
	p: AccessPrincipal,
): Record<string, never> | { deal: Prisma.DealWhereInput } {
	if (isUnscoped(p)) return {};
	return { deal: dealScopeWhere(p) };
}

export function contactScopeWhere(
	p: AccessPrincipal,
): Prisma.ContactWhereInput {
	if (isUnscoped(p)) return {};
	const deal = dealScopeWhere(p);
	if (p.scope === "OWN")
		return { OR: [{ ownerId: p.userId }, { deals: { some: { deal } } }] };
	return { deals: { some: { deal } } };
}

export function photoScopeWhere(p: AccessPrincipal): Prisma.PhotoWhereInput {
	if (isUnscoped(p)) return {};
	return {
		OR: [
			{ deal: dealScopeWhere(p) },
			{ dealId: null, contact: contactScopeWhere(p) },
		],
	};
}

export function activityScopeWhere(
	p: AccessPrincipal,
): Prisma.ActivityWhereInput {
	if (isUnscoped(p)) return {};
	return {
		OR: [
			{ deal: dealScopeWhere(p) },
			{ dealId: null, contactId: null, createdById: p.userId },
			{ dealId: null, contact: contactScopeWhere(p) },
		],
	};
}
