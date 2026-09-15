import type { MoneySwitch } from "./access-config";
import { type AccessPrincipal, hasMoney } from "./access-policy";

export type Masked<T, K extends keyof T> = {
	[P in keyof T]: P extends K ? T[P] | null : T[P];
};

export function maskCents<T extends object, K extends keyof T>(
	p: AccessPrincipal,
	money: MoneySwitch,
	row: T,
	keys: readonly K[],
): Masked<T, K> {
	if (hasMoney(p, money)) return row as Masked<T, K>;
	const copy = { ...row } as Record<keyof T, unknown>;
	for (const key of keys) copy[key] = null;
	return copy as Masked<T, K>;
}

export function maskLineItems<T extends object, K extends keyof T>(
	p: AccessPrincipal,
	money: MoneySwitch,
	rows: readonly T[],
	keys: readonly K[],
): Masked<T, K>[] {
	return rows.map((row) => maskCents(p, money, row, keys));
}

export function moneyRefusalMessage(
	p: AccessPrincipal,
	suffix: string,
): string {
	if (!p.groupName) {
		return `You aren't in a group yet, so you can't ${suffix} Ask an admin.`;
	}
	return `Your group (${p.groupName}) can't ${suffix} Ask an admin.`;
}
