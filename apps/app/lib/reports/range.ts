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

export function presetRange(
	preset: Exclude<ReportRangePreset, "custom">,
	now: Date,
): { from: Date; to: Date } {
	const to = startOfDay(now);
	if (preset === "30d") {
		return { from: new Date(to.getTime() - 29 * DAY_MS), to };
	}
	if (preset === "90d") {
		return { from: new Date(to.getTime() - 89 * DAY_MS), to };
	}
	return {
		from: new Date(to.getFullYear(), to.getMonth() - 11, to.getDate()),
		to,
	};
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
