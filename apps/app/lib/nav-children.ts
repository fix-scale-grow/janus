export const HIDE_PROOF = ["/settings"];

export function applyNavHidden<T extends { href: string }>(
	items: T[],
	hidden: string[] | undefined,
): T[] {
	if (!hidden || hidden.length === 0) return items;

	return items.filter(
		(item) => HIDE_PROOF.includes(item.href) || !hidden.includes(item.href),
	);
}

export function isChildHidden(
	childId: string,
	hidden: string[] | undefined,
): boolean {
	return Boolean(hidden?.includes(childId));
}
