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

export type AreaAccess = Pick<MyAccess, "isAdmin" | "areas">;

function areaPrincipal(access: AreaAccess): AccessPrincipal {
	return {
		userId: "",
		isAdmin: access.isAdmin,
		groupId: null,
		groupName: null,
		surface: "FULL",
		scope: "OWN",
		policy: { areas: access.areas, actions: [], money: [] },
	};
}

export function moduleHidden(
	access: AreaAccess,
	href: string,
	modules: readonly JanusModule[],
): boolean {
	const area = modules.find((m) => m.href === href)?.area;
	if (!area) return false;
	return !allows(areaPrincipal(access), area, "VIEW");
}

export function areaRedirect(
	access: AreaAccess | null,
	pathname: string,
	slug: string,
	modules: readonly JanusModule[],
): string | null {
	if (!access) return null;
	const root = `/${slug}`;
	if (!pathname.startsWith(`${root}/`)) return null;
	const href = pathname.slice(root.length);
	return moduleHidden(access, href, modules) ? root : null;
}

export function canManageFields(mine: MyAccess): boolean {
	return mine.isAdmin;
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

const SETTINGS_PER_USER_PATHS = ["/settings/navigation"];

export function settingsRedirect(
	isAdmin: boolean,
	pathname: string,
	slug: string,
): string | null {
	if (isAdmin) return null;
	const root = `/${slug}/settings`;
	if (!(pathname === root || pathname.startsWith(`${root}/`))) return null;
	const isPerUser = SETTINGS_PER_USER_PATHS.some((path) => {
		const full = `/${slug}${path}`;
		return pathname === full || pathname.startsWith(`${full}/`);
	});
	return isPerUser ? null : `/${slug}`;
}
