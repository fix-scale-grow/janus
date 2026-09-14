import { toDay } from "../projects/projects.contracts";

const DAY_MS = 24 * 60 * 60 * 1000;

export const AGING_BUCKETS = [
	"current",
	"1-30",
	"31-60",
	"61-90",
	"90+",
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingDays(dueAt: Date, now: Date): number {
	return Math.round((toDay(now).getTime() - toDay(dueAt).getTime()) / DAY_MS);
}

export function agingBucket(dueAt: Date, now: Date): AgingBucket {
	const ageDays = agingDays(dueAt, now);
	if (ageDays <= 0) return "current";
	if (ageDays <= 30) return "1-30";
	if (ageDays <= 60) return "31-60";
	if (ageDays <= 90) return "61-90";
	return "90+";
}

export function fallbackDueAt(invoice: {
	dueAt: Date | null;
	issuedAt: Date | null;
	createdAt: Date;
}): Date {
	if (invoice.dueAt) return invoice.dueAt;
	const base = invoice.issuedAt ?? invoice.createdAt;
	return new Date(base.getTime() + 30 * DAY_MS);
}

export function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * DAY_MS);
}

export type ResolvedRange = { gte: Date; lt: Date };

export function resolveRange(from: Date, to: Date): ResolvedRange {
	return { gte: from, lt: addDays(toDay(to), 1) };
}

export function dateInRange(date: Date, range: ResolvedRange): boolean {
	return date >= range.gte && date < range.lt;
}

export function monthKey(date: Date): string {
	return date.toISOString().slice(0, 7);
}

export function monthsBetween(from: Date, to: Date): string[] {
	const months: string[] = [];
	let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
	const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
	while (cursor.getTime() <= end.getTime()) {
		months.push(monthKey(cursor));
		cursor = new Date(
			Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
		);
	}
	return months;
}
