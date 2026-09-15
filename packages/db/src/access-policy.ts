import { z } from "zod";
import {
	ACCESS,
	ACCESS_AREAS,
	ACCESS_LEVELS,
	type AccessArea,
	type AccessLevel,
	type AccessScope,
	type AccessSurface,
	MONEY_SWITCHES,
	type MoneySwitch,
	STANDALONE_ACTIONS,
	type StandaloneAction,
} from "./access-config";

const levelSchema = z.enum(ACCESS_LEVELS);

export const accessPolicySchema = z
	.object({
		areas: z.object(
			Object.fromEntries(
				ACCESS_AREAS.map((area) => [area, levelSchema]),
			) as Record<AccessArea, typeof levelSchema>,
		),
		actions: z.array(z.enum(STANDALONE_ACTIONS)),
		money: z.array(z.enum(MONEY_SWITCHES)),
	})
	.superRefine((policy, ctx) => {
		for (const area of ACCESS.viewOnlyAreas) {
			if (policy.areas[area] === "EDIT" || policy.areas[area] === "DELETE") {
				ctx.addIssue({
					code: "custom",
					path: ["areas", area],
					message: `${area} accepts only HIDDEN or VIEW`,
				});
			}
		}
	});

export type AccessPolicy = z.infer<typeof accessPolicySchema>;

export function parseAccessPolicy(
	value: unknown,
	groupName: string,
): AccessPolicy {
	const parsed = accessPolicySchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			`Access group "${groupName}" has an unreadable policy: ${parsed.error.issues
				.map((issue) => `${issue.path.join(".")} ${issue.message}`)
				.join("; ")}`,
		);
	}
	return parsed.data;
}

export type AccessPrincipal = {
	userId: string;
	isAdmin: boolean;
	groupId: string | null;
	groupName: string | null;
	surface: AccessSurface;
	scope: AccessScope;
	policy: AccessPolicy;
};

export type AccessNeed = AccessLevel | StandaloneAction;

const RANK: Record<AccessLevel, number> = {
	HIDDEN: 0,
	VIEW: 1,
	EDIT: 2,
	DELETE: 3,
};

function isLevel(need: AccessNeed): need is AccessLevel {
	return (ACCESS_LEVELS as readonly string[]).includes(need);
}

function allowsOne(
	p: AccessPrincipal,
	area: AccessArea,
	need: AccessNeed,
): boolean {
	if (p.isAdmin) return true;
	if (isLevel(need)) {
		if (need === "HIDDEN") return true;
		return RANK[p.policy.areas[area]] >= RANK[need];
	}
	return p.policy.actions.includes(need);
}

export function allows(
	p: AccessPrincipal,
	area: AccessArea,
	need: AccessNeed | readonly AccessNeed[],
): boolean {
	const needs = typeof need === "string" ? [need] : need;
	return needs.some((one) => allowsOne(p, area, one));
}

export function hasMoney(p: AccessPrincipal, money: MoneySwitch): boolean {
	return p.isAdmin || p.policy.money.includes(money);
}

function emptyAreas(level: AccessLevel): AccessPolicy["areas"] {
	return Object.fromEntries(
		ACCESS_AREAS.map((area) => [area, level]),
	) as AccessPolicy["areas"];
}

export function adminPrincipal(userId: string): AccessPrincipal {
	return {
		userId,
		isAdmin: true,
		groupId: null,
		groupName: null,
		surface: "FULL",
		scope: "ALL",
		policy: {
			areas: emptyAreas("DELETE"),
			actions: [...STANDALONE_ACTIONS],
			money: [...MONEY_SWITCHES],
		},
	};
}

export function noAccessPrincipal(userId: string): AccessPrincipal {
	return {
		userId,
		isAdmin: false,
		groupId: null,
		groupName: null,
		surface: "FULL",
		scope: "ASSIGNED",
		policy: { areas: emptyAreas("HIDDEN"), actions: [], money: [] },
	};
}

export function refusalMessage(
	p: AccessPrincipal,
	area: AccessArea,
	need: AccessNeed,
): string {
	const verb = isLevel(need) ? ACCESS.levelVerb[need] : ACCESS.actionVerb[need];
	if (!p.groupName) {
		return `You aren't in a group yet, so you can't ${verb} ${ACCESS.areaLabel[area]}. Ask an admin.`;
	}
	return `Your group (${p.groupName}) can't ${verb} ${ACCESS.areaLabel[area]}. Ask an admin.`;
}
