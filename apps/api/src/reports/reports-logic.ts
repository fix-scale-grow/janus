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
