export const PROJECTS = {
	task: { max: 500, nameMax: 200, noteMax: 2000, maxSpanDays: 30 },
	project: { nameMax: 200, goalMax: 500 },
	calendar: { maxRangeDays: 62 },
	upcoming: { days: 14, take: 8 },
} as const;
