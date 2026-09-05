const DAY_MS = 86_400_000;

export function addDays(day: Date, count: number): Date {
	return new Date(day.getTime() + count * DAY_MS);
}

export function dayKey(day: Date | null): string {
	return day ? day.toISOString().slice(0, 10) : "unscheduled";
}

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

export function dayRange(options: {
	startDate: Date;
	goalDate: Date | null;
	taskDays: Date[];
	today: Date;
	max: number;
}): Date[] {
	const start = startOfUtcDay(options.startDate);
	const goal = startOfUtcDay(options.goalDate ?? options.startDate);
	const today = startOfUtcDay(options.today);
	const taskDays = options.taskDays.map(startOfUtcDay);

	const latestTaskTime = taskDays.length
		? Math.max(...taskDays.map((day) => day.getTime()))
		: start.getTime();

	const endTime = Math.max(
		start.getTime(),
		goal.getTime(),
		today.getTime(),
		latestTaskTime,
	);

	const fullSpanDays = Math.round((endTime - start.getTime()) / DAY_MS) + 1;
	const count = Math.min(fullSpanDays, options.max);
	const truncatedEndTime = addDays(start, count - 1).getTime();

	const days: Date[] = [];
	for (let index = 0; index < count; index += 1) {
		days.push(addDays(start, index));
	}

	const seen = new Set(days.map((day) => day.getTime()));
	for (const day of taskDays) {
		const time = day.getTime();
		if (time < start.getTime() || time > truncatedEndTime) {
			if (!seen.has(time)) {
				seen.add(time);
				days.push(day);
			}
		}
	}

	days.sort((a, b) => a.getTime() - b.getTime());
	return days;
}
