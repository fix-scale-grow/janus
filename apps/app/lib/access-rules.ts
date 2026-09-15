import type {
	AccessArea,
	AccessSurface,
	MoneySwitch,
} from "@crm/db/access-config";
import { ACCESS } from "@crm/db/access-config";
import {
	type AccessNeed,
	type AccessPrincipal,
	allows,
	hasMoney,
} from "@crm/db/access-policy";
import type { JanusModule } from "./janus-nav";

export type MyAccess = {
	isAdmin: boolean;
	groupId: string | null;
	groupName: string | null;
	surface: AccessSurface;
	scope: AccessPrincipal["scope"];
	areas: AccessPrincipal["policy"]["areas"];
	actions: readonly AccessPrincipal["policy"]["actions"][number][];
	money: readonly MoneySwitch[];
};

export function toPrincipal(mine: MyAccess, userId = ""): AccessPrincipal {
	return {
		userId,
		isAdmin: mine.isAdmin,
		groupId: mine.groupId,
		groupName: mine.groupName,
		surface: mine.surface,
		scope: mine.scope,
		policy: {
			areas: mine.areas,
			actions: [...mine.actions],
			money: [...mine.money],
		},
	};
}

export function visibleModules(
	modules: readonly JanusModule[],
	mine: MyAccess,
): JanusModule[] {
	const p = toPrincipal(mine);
	if (mine.surface === "FIELD") {
		return modules.filter((m) => m.href === ACCESS.fieldPathPrefix);
	}
	return modules.filter((m) => {
		if (m.href === "/settings") return mine.isAdmin;
		if (!m.area) return true;
		return allows(p, m.area, "VIEW");
	});
}

export function canArea(
	mine: MyAccess,
	area: AccessArea,
	need: AccessNeed,
): boolean {
	return allows(toPrincipal(mine), area, need);
}

export function canMoney(mine: MyAccess, sw: MoneySwitch): boolean {
	return hasMoney(toPrincipal(mine), sw);
}

export function fieldRedirect(
	surface: AccessSurface | null,
	pathname: string,
	slug: string,
): string | null {
	if (surface !== "FIELD") return null;
	const home = `/${slug}${ACCESS.fieldPathPrefix}`;
	return pathname === home || pathname.startsWith(`${home}/`) ? null : home;
}
