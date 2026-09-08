export function applyNavOrder<T extends { href: string }>(
	items: T[],
	order: string[] | undefined,
): T[] {
	if (!order || order.length === 0) return items;

	const byHref = new Map(items.map((item) => [item.href, item]));
	const ordered: T[] = [];

	for (const href of order) {
		const item = byHref.get(href);
		if (item) {
			ordered.push(item);
			byHref.delete(href);
		}
	}

	for (const item of items) {
		if (byHref.has(item.href)) {
			ordered.push(item);
			byHref.delete(item.href);
		}
	}

	return ordered;
}
