export const HIDE_PROOF = ["/settings"];

const FEATURE_GATED_HREFS = ["/permits"];

export function applyNavHidden<T extends { href: string }>(
	items: T[],
	hidden: string[] | undefined,
): T[] {
	if (!hidden || hidden.length === 0) return items;

	return items.filter(
		(item) => HIDE_PROOF.includes(item.href) || !hidden.includes(item.href),
	);
}

export function applyPermitsGate<T extends { href: string }>(
	items: T[],
	permitsEnabled: boolean,
): T[] {
	if (permitsEnabled) return items;
	return items.filter((item) => !FEATURE_GATED_HREFS.includes(item.href));
}

export function isChildHidden(
	childId: string,
	hidden: string[] | undefined,
): boolean {
	return Boolean(hidden?.includes(childId));
}
