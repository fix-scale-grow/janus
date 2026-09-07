const DAY_MS = 86_400_000;

export function dayKey(day: Date): string {
	return day.toISOString().slice(0, 10);
}

export function fromDayKey(key: string): Date {
	return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(day: Date, count: number): Date {
	return new Date(day.getTime() + count * DAY_MS);
}

function startOfWeek(day: Date): Date {
	return addDays(day, -day.getUTCDay());
}

export function weekOf(anchor: Date): Date[] {
	const start = startOfWeek(anchor);
	return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthWeeks(anchor: Date): Date[][] {
	const first = new Date(
		Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
	);
	const last = new Date(
		Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
	);
	const weeks: Date[][] = [];
	for (
		let cursor = startOfWeek(first);
		cursor.getTime() <= last.getTime();
		cursor = addDays(cursor, 7)
	) {
		weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
	}
	return weeks;
}

export type SpanTask = {
	id: string;
	startDay: Date;
	endDay: Date;
	sortOrder: number;
};

export type WeekBar<T extends SpanTask> = {
	task: T;
	startCol: number;
	endCol: number;
	lane: number;
	clippedStart: boolean;
	clippedEnd: boolean;
};

export function layoutWeek<T extends SpanTask>(
	tasks: T[],
	weekStart: Date,
	maxLanes: number,
): { bars: WeekBar<T>[]; overflow: number[] } {
	const weekEnd = addDays(weekStart, 6);
	const inWeek = tasks
		.filter(
			(task) =>
				task.startDay.getTime() <= weekEnd.getTime() &&
				task.endDay.getTime() >= weekStart.getTime(),
		)
		.sort(
			(a, b) =>
				a.startDay.getTime() - b.startDay.getTime() ||
				b.endDay.getTime() - a.endDay.getTime() ||
				a.sortOrder - b.sortOrder,
		);

	const laneEnds: number[] = [];
	const bars: WeekBar<T>[] = [];
	const overflow: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];

	for (const task of inWeek) {
		const startCol = Math.max(
			0,
			Math.round((task.startDay.getTime() - weekStart.getTime()) / DAY_MS),
		);
		const endCol = Math.min(
			6,
			Math.round((task.endDay.getTime() - weekStart.getTime()) / DAY_MS),
		);
		let lane = laneEnds.findIndex((end) => end < startCol);
		if (lane === -1) lane = laneEnds.length;
		if (lane >= maxLanes) {
			for (let col = startCol; col <= endCol; col += 1) overflow[col] = (overflow[col] ?? 0) + 1;
			continue;
		}
		laneEnds[lane] = endCol;
		bars.push({
			task,
			startCol,
			endCol,
			lane,
			clippedStart: task.startDay.getTime() < weekStart.getTime(),
			clippedEnd: task.endDay.getTime() > weekEnd.getTime(),
		});
	}
	return { bars, overflow };
}
