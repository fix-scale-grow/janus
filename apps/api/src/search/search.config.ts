export const SEARCH = {
	perKind: 5,
	minLength: 2,
	maxTokens: 4,
	maxInt32: 2_147_483_647,
} as const;

export function parseNumberQuery(term: string): number | null {
	const digits = term.startsWith("#") ? term.slice(1) : term;
	if (!/^\d+$/.test(digits)) return null;

	const value = Number(digits);
	if (value > SEARCH.maxInt32) return null;

	return value;
}
