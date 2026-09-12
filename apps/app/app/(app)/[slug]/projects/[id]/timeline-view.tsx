"use client";

import { Badge } from "@crm/ui/components/badge";
import { cn } from "@crm/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import type {
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { BoardDensity } from "@/components/board/use-board-density";
import { usePanScroll } from "@/components/board/use-pan-scroll";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { CALENDAR } from "@/lib/calendar/calendar-config";
import { addDays, dayKey, weekOf } from "@/lib/calendar/span-layout";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { CalendarTask, Project } from "./calendar-view";
import { barClasses, taskBarClasses } from "./task-bar";
import {
	STATUS_FLOW,
	STATUS_LABEL,
	STATUS_VARIANT,
	TaskPopover,
	useCycleTaskStatus,
} from "./task-card";

const DAY_MS = 86_400_000;
const DAY_WIDTH_REM = 2.5;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SHORT_DATE_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

function todayUtc(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function TimelineView({
	project,
	anchor,
	density,
}: {
	project: Project;
	anchor: Date;
	density?: BoardDensity;
}) {
	const { ref, handlers } = usePanScroll<HTMLDivElement>();

	const windowStart = useMemo(() => weekOf(anchor)[0] ?? anchor, [anchor]);
	const days = useMemo(
		() =>
			Array.from({ length: CALENDAR.timelineDays }, (_, index) =>
				addDays(windowStart, index),
			),
		[windowStart],
	);
	const windowEnd = days[days.length - 1] ?? windowStart;
	const trackWidthRem = days.length * DAY_WIDTH_REM;

	const today = useMemo(() => todayUtc(), []);
	const todayKey = dayKey(today);

	const rows = useMemo<CalendarTask[]>(
		() =>
			project.tasks
				.filter(
					(task): task is typeof task & { startDay: string; endDay: string } =>
						task.startDay != null && task.endDay != null,
				)
				.map((task) => ({
					...task,
					startDay: new Date(task.startDay),
					endDay: new Date(task.endDay),
				}))
				.sort((a, b) => a.startDay.getTime() - b.startDay.getTime()),
		[project.tasks],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-border">
			<div
				ref={ref}
				{...handlers}
				className="cursor-grab overflow-x-auto active:cursor-grabbing"
			>
				<div className="sticky top-0 z-20 flex bg-background">
					<div className="sticky left-0 z-30 w-56 shrink-0 border-r border-b border-border bg-background" />
					<div className="flex">
						{days.map((day) => {
							const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
							const isToday = dayKey(day) === todayKey;
							return (
								<div
									key={dayKey(day)}
									className={cn(
										"w-10 shrink-0 border-r border-b border-border px-1 py-1 text-center text-xs text-muted-foreground last:border-r-0",
										isWeekend && "bg-muted/40",
										isToday && "ring-2 ring-primary ring-inset",
									)}
								>
									<div>{WEEKDAY_LABELS[day.getUTCDay()]}</div>
									<div className="font-medium text-foreground">
										{day.getUTCDate()}
									</div>
								</div>
							);
						})}
					</div>
				</div>
				{rows.map((task) => (
					<TimelineRow
						key={task.id}
						task={task}
						projectId={project.id}
						windowStart={windowStart}
						windowEnd={windowEnd}
						trackWidthRem={trackWidthRem}
						density={density}
					/>
				))}
			</div>
		</div>
	);
}

function TimelineRow({
	task,
	projectId,
	windowStart,
	windowEnd,
	trackWidthRem,
	density,
}: {
	task: CalendarTask;
	projectId: string;
	windowStart: Date;
	windowEnd: Date;
	trackWidthRem: number;
	density?: BoardDensity;
}) {
	const compact = density === "compact";
	const cycleStatus = useCycleTaskStatus(projectId);
	const colors = task.crew
		? (CREW_COLOR_CLASSES[task.crew.color] ?? NO_CREW_CLASSES)
		: NO_CREW_CLASSES;

	const outside =
		task.endDay.getTime() < windowStart.getTime() ||
		task.startDay.getTime() > windowEnd.getTime();

	const rangeLabel = outside
		? task.startDay.getTime() > windowEnd.getTime()
			? `→ ${SHORT_DATE_LABEL.format(task.startDay)}`
			: `← ${SHORT_DATE_LABEL.format(task.endDay)}`
		: null;

	const clampedStart =
		task.startDay.getTime() < windowStart.getTime()
			? windowStart
			: task.startDay;
	const clampedEnd =
		task.endDay.getTime() > windowEnd.getTime() ? windowEnd : task.endDay;
	const offsetDays = Math.round(
		(clampedStart.getTime() - windowStart.getTime()) / DAY_MS,
	);
	const spanDays = Math.max(
		1,
		Math.round((clampedEnd.getTime() - clampedStart.getTime()) / DAY_MS) + 1,
	);

	return (
		<div className="flex border-b border-border last:border-b-0">
			<div className="sticky left-0 z-10 flex w-56 shrink-0 items-center gap-1.5 border-r border-border bg-background px-2 py-1.5 text-xs">
				<span className={cn("size-2 shrink-0 rounded-full", colors.dot)} />
				<span className="flex-1 truncate text-sm text-foreground">
					{task.name}
				</span>
				{rangeLabel ? (
					<span className="shrink-0 text-muted-foreground">{rangeLabel}</span>
				) : null}
				{compact ? null : (
					<button
						type="button"
						onClick={() =>
							cycleStatus.mutate({
								id: task.id,
								status: STATUS_FLOW[task.status],
							})
						}
						disabled={cycleStatus.isPending}
						className="shrink-0"
					>
						<Badge variant={STATUS_VARIANT[task.status]}>
							{STATUS_LABEL[task.status]}
						</Badge>
					</button>
				)}
			</div>
			<div
				data-timeline-track=""
				className="relative"
				style={{
					width: `${trackWidthRem}rem`,
					height: compact ? "1.75rem" : "2.25rem",
				}}
			>
				{outside ? null : (
					<TimelineBar
						task={task}
						projectId={projectId}
						offsetDays={offsetDays}
						spanDays={spanDays}
						clippedStart={task.startDay.getTime() < windowStart.getTime()}
						clippedEnd={task.endDay.getTime() > windowEnd.getTime()}
						density={density}
					/>
				)}
			</div>
		</div>
	);
}

type TimelineDragMode = "move" | "start" | "end";

function TimelineBar({
	task,
	projectId,
	offsetDays,
	spanDays,
	clippedStart,
	clippedEnd,
	density,
}: {
	task: CalendarTask;
	projectId: string;
	offsetDays: number;
	spanDays: number;
	clippedStart: boolean;
	clippedEnd: boolean;
	density?: BoardDensity;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [preview, setPreview] = useState<{
		mode: TimelineDragMode;
		delta: number;
	} | null>(null);
	const drag = useRef<{
		mode: TimelineDragMode;
		startX: number;
		dayWidth: number;
		moved: boolean;
	} | null>(null);
	const suppressClickUntil = useRef(0);

	const taskMove = useMutation(
		trpc.projects.taskMove.mutationOptions({
			onSuccess: () => cache.project(projectId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const clampedDelta = (mode: TimelineDragMode, rawDelta: number): number => {
		if (mode === "start") {
			const minStart = addDays(task.endDay, -(CALENDAR.maxTaskSpanDays - 1));
			const next = addDays(task.startDay, rawDelta);
			const clamped =
				next.getTime() > task.endDay.getTime()
					? task.endDay
					: next.getTime() < minStart.getTime()
						? minStart
						: next;
			return Math.round((clamped.getTime() - task.startDay.getTime()) / DAY_MS);
		}
		if (mode === "end") {
			const maxEnd = addDays(task.startDay, CALENDAR.maxTaskSpanDays - 1);
			const next = addDays(task.endDay, rawDelta);
			const clamped =
				next.getTime() < task.startDay.getTime()
					? task.startDay
					: next.getTime() > maxEnd.getTime()
						? maxEnd
						: next;
			return Math.round((clamped.getTime() - task.endDay.getTime()) / DAY_MS);
		}
		return rawDelta;
	};

	const reset = () => {
		drag.current = null;
		setPreview(null);
	};

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		if (!(event.target instanceof Element)) return;
		const edge = event.target.closest("[data-edge]");
		const mode = (edge?.getAttribute("data-edge") ??
			"move") as TimelineDragMode;
		const track = event.currentTarget.closest("[data-timeline-track]");
		const dayWidth = track
			? track.getBoundingClientRect().width / CALENDAR.timelineDays
			: 40;
		drag.current = { mode, startX: event.clientX, dayWidth, moved: false };
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state) return;
		if ((event.buttons & 1) === 0) {
			reset();
			return;
		}
		if (!state.moved && Math.abs(event.clientX - state.startX) < 5) return;
		state.moved = true;
		if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		const rawDelta = Math.round(
			(event.clientX - state.startX) / state.dayWidth,
		);
		setPreview({ mode: state.mode, delta: clampedDelta(state.mode, rawDelta) });
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state) return;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		const rawDelta = Math.round(
			(event.clientX - state.startX) / state.dayWidth,
		);
		const delta = state.moved ? clampedDelta(state.mode, rawDelta) : 0;
		const moved = state.moved;
		const mode = state.mode;
		reset();
		if (!moved) return;
		suppressClickUntil.current = Date.now() + 300;
		if (delta === 0) return;
		taskMove.mutate({
			id: task.id,
			startDay: mode === "end" ? task.startDay : addDays(task.startDay, delta),
			endDay: mode === "start" ? task.endDay : addDays(task.endDay, delta),
			sortOrder: task.sortOrder,
		});
	};

	const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
		if (Date.now() < suppressClickUntil.current) {
			event.preventDefault();
			event.stopPropagation();
		}
	};

	const previewDelta = preview?.delta ?? 0;
	const displayOffset = Math.max(
		0,
		preview && preview.mode !== "end" ? offsetDays + previewDelta : offsetDays,
	);
	const rawSpan =
		preview?.mode === "start"
			? spanDays - previewDelta
			: preview?.mode === "end"
				? spanDays + previewDelta
				: spanDays;
	const displaySpan = Math.max(
		1,
		Math.min(rawSpan, CALENDAR.timelineDays - displayOffset),
	);

	return (
		<div
			data-board-drag=""
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={reset}
			onLostPointerCapture={reset}
			onClickCapture={onClickCapture}
			style={{
				left: `${displayOffset * DAY_WIDTH_REM}rem`,
				width: `${displaySpan * DAY_WIDTH_REM}rem`,
			}}
			className={cn(
				taskBarClasses(density),
				barClasses(task),
				"absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing",
				clippedStart ? "rounded-l-none border-l-0" : "pl-2.5",
				clippedEnd ? "rounded-r-none border-r-0" : "pr-2.5",
			)}
		>
			<TaskPopover projectId={projectId} task={task} density={density}>
				<button type="button" className="min-w-0 flex-1 truncate text-left">
					{task.name}
				</button>
			</TaskPopover>
			{!clippedStart ? (
				<span
					data-edge="start"
					className="absolute inset-y-0 left-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center"
				>
					<span className="h-3 w-0.5 rounded-sm bg-current opacity-30" />
				</span>
			) : null}
			{!clippedEnd ? (
				<span
					data-edge="end"
					className="absolute inset-y-0 right-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center"
				>
					<span className="h-3 w-0.5 rounded-sm bg-current opacity-30" />
				</span>
			) : null}
		</div>
	);
}
