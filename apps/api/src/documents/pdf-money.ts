export function formatCents(cents: number, currency: string): string {
	const code = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : "USD";

	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: code,
		}).format(cents / 100);
	} catch {
		return `${code} ${(cents / 100).toFixed(2)}`;
	}
}
