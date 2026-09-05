export function formatCount(
	count: number,
	noun: string,
	plural = `${noun}s`,
): string {
	return `${count} ${count === 1 ? noun : plural}`;
}

const WELL_FORMED_CURRENCY_CODE = /^[A-Za-z]{3}$/;
const percentFormat = new Intl.NumberFormat("en-US", {
	style: "percent",
	maximumFractionDigits: 0,
});

function displayCurrencyCode(currency: string): string {
	return WELL_FORMED_CURRENCY_CODE.test(currency)
		? currency.toUpperCase()
		: "USD";
}

const currencyDigits = new Map<string, number>();

function fractionDigits(code: string): number {
	const cached = currencyDigits.get(code);
	if (cached !== undefined) return cached;

	let digits = 2;
	try {
		digits =
			new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: code,
			}).resolvedOptions().maximumFractionDigits ?? 2;
	} catch {
		digits = 2;
	}

	currencyDigits.set(code, digits);
	return digits;
}

export function formatMoney(cents: number, currency = "usd"): string {
	const code = displayCurrencyCode(currency);
	const whole = cents % 100 === 0;
	const digits = fractionDigits(code);

	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: code,
			minimumFractionDigits: whole ? 0 : Math.min(2, digits),
			maximumFractionDigits: whole ? 0 : digits,
		}).format(cents / 100);
	} catch {
		return `${code} ${(cents / 100).toFixed(whole ? 0 : 2)}`;
	}
}

const currencySymbols = new Map<string, string>();

export function currencySymbol(currency = "usd"): string {
	const code = displayCurrencyCode(currency);
	const cached = currencySymbols.get(code);
	if (cached !== undefined) return cached;

	let symbol = code;
	try {
		symbol =
			new Intl.NumberFormat(undefined, {
				style: "currency",
				currency: code,
				currencyDisplay: "narrowSymbol",
			})
				.formatToParts(0)
				.find((part) => part.type === "currency")?.value ?? code;
	} catch {
		symbol = code;
	}

	currencySymbols.set(code, symbol);
	return symbol;
}

export function formatMoneyCompact(cents: number, currency = "usd"): string {
	const code = displayCurrencyCode(currency);

	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: code,
			notation: "compact",
			maximumFractionDigits: cents % 100_000 === 0 ? 0 : 1,
		}).format(cents / 100);
	} catch {
		return `${code} ${(cents / 100).toFixed(0)}`;
	}
}

export function formatPercent(rate: number): string {
	return percentFormat.format(rate);
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

export function toDay(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDay(value: string | null | undefined): Date | undefined {
	if (!value) return undefined;
	const [year, month, day] = value.slice(0, 10).split("-").map(Number);
	if (!year || !month || !day) return undefined;
	const date = new Date(year, month - 1, day);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDay(value: string | null | undefined): string {
	const date = fromDay(value);
	return date ? dayFormat.format(date) : (value ?? "—");
}

export function initialsFromName(name: string | null | undefined): string {
	const parts = (name ?? "").split(/\s+/).filter(Boolean);
	const first = parts[0];
	if (!first) return "?";
	if (parts.length === 1) return first.slice(0, 2).toUpperCase();
	const last = parts[parts.length - 1] ?? first;
	return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase();
}
