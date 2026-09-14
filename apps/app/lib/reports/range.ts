import {
	createLoader,
	parseAsIsoDate,
	parseAsStringLiteral,
} from "nuqs/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export const REPORT_RANGE_PRESETS = ["30d", "90d", "12m", "custom"] as const;
export type ReportRangePreset = (typeof REPORT_RANGE_PRESETS)[number];

export const reportRangeParsers = {
	preset: parseAsStringLiteral(REPORT_RANGE_PRESETS).withDefault("90d"),
	from: parseAsIsoDate,
	to: parseAsIsoDate,
};

export const loadReportRangeParams = createLoader(reportRangeParsers);

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		23,
		59,
		59,
		999,
	);
}

export function presetRange(
	preset: Exclude<ReportRangePreset, "custom">,
	now: Date,
): { from: Date; to: Date } {
	const dayStart = startOfDay(now);
	const to = endOfDay(now);
	if (preset === "30d") {
		return { from: new Date(dayStart.getTime() - 29 * DAY_MS), to };
	}
	if (preset === "90d") {
		return { from: new Date(dayStart.getTime() - 89 * DAY_MS), to };
	}
	return {
		from: new Date(
			dayStart.getFullYear(),
			dayStart.getMonth() - 11,
			dayStart.getDate(),
		),
		to,
	};
}

function pad(value: number): string {
	return value.toString().padStart(2, "0");
}

export function bucketMonths(from: Date, to: Date): string[] {
	const months: string[] = [];
	let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
	const end = new Date(to.getFullYear(), to.getMonth(), 1);
	while (cursor.getTime() <= end.getTime()) {
		months.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`);
		cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
	}
	return months;
}

export function effectiveRange(
	range: { preset: ReportRangePreset; from: Date | null; to: Date | null },
	now: Date,
): { from: Date | undefined; to: Date | undefined } {
	if (range.preset === "custom") {
		return { from: range.from ?? undefined, to: range.to ?? undefined };
	}
	return presetRange(range.preset, now);
}

export const AGING_BUCKETS = [
	"current",
	"1-30",
	"31-60",
	"61-90",
	"90+",
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(dueAt: Date, now: Date): AgingBucket {
	const ageDays = Math.round(
		(startOfDay(now).getTime() - startOfDay(dueAt).getTime()) / DAY_MS,
	);
	if (ageDays <= 0) return "current";
	if (ageDays <= 30) return "1-30";
	if (ageDays <= 60) return "31-60";
	if (ageDays <= 90) return "61-90";
	return "90+";
}
