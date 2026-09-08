"use client";

import { Button } from "@crm/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useMemo, useState } from "react";
import { NO_CREW_CLASSES } from "@/components/crews/crew-colors";
import { CALENDAR } from "@/lib/calendar/calendar-config";
import {
	addDays,
	dayKey,
	layoutWeek,
	monthWeeks,
	type WeekBar,
	weekOf,
} from "@/lib/calendar/span-layout";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import {
	normalizeProjectStatus,
	type ProjectStatusFilter,
} from "./projects-search-params";

type CalendarRow = RouterOutputs["projects"]["calendarRange"][number];

type ProjectSpan = {
	id: string;
	name: string;
	status: CalendarRow["status"];
	dealName: string;
	startDay: Date;
	endDay: Date;
	sortOrder: number;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_TABS: { value: ProjectStatusFilter; label: string }[] = [
	{ value: "all", label: "All projects" },
	{ value: "ACTIVE", label: "Active" },
	{ value: "ON_HOLD", label: "On hold" },
	{ value: "COMPLETE", label: "Complete" },
];

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

const WEEK_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

function todayUtc(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function ProjectsCalendar({ viewToggle }: { viewToggle: ReactNode }) {
	const trpc = useTRPC();
	const [view, setView] = useState<"month" | "week">("month");
	const [anchor, setAnchor] = useState<Date>(() => todayUtc());
	const [statusParam, setStatusParam] = useQueryState(
		"status",
		parseAsString.withDefault("all"),
	);
	const status = normalizeProjectStatus(statusParam);

	const weeks = useMemo(
		() => (view === "month" ? monthWeeks(anchor) : [weekOf(anchor)]),
		[view, anchor],
	);

	const from = weeks[0]?.[0] ?? anchor;
	const to = addDays(weeks[weeks.length - 1]?.[0] ?? anchor, 6);

	const projects = useQuery({
		...trpc.projects.calendarRange.queryOptions({
			from,
			to,
			status: status === "all" ? undefined : status,
		}),
		placeholderData: (previous) => previous,
	});

	const spans = useMemo<ProjectSpan[]>(
		() =>
			(projects.data ?? []).map((row) => ({
				id: row.id,
				name: row.name,
				status: row.status,
				dealName: row.deal.name,
				startDay: new Date(row.startDate),
				endDay: new Date(row.endDate),
				sortOrder: 0,
			})),
		[projects.data],
	);

	const today = useMemo(() => todayUtc(), []);
	const todayKey = dayKey(today);

	const rangeLabel =
		view === "month"
			? MONTH_LABEL.format(anchor)
			: `${WEEK_LABEL.format(weeks[0]?.[0] ?? anchor)} – ${WEEK_LABEL.format(weeks[0]?.[6] ?? anchor)}`;

	function shift(direction: 1 | -1) {
		if (view === "month") {
			setAnchor(
				(current) =>
					new Date(
						Date.UTC(
							current.getUTCFullYear(),
							current.getUTCMonth() + direction,
							1,
						),
					),
			);
			return;
		}
		setAnchor((current) => addDays(current, 7 * direction));
	}

	const maxLanes =
		view === "month" ? CALENDAR.monthMaxLanes : CALENDAR.weekMaxLanes;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<Tabs
					value={status}
					onValueChange={(next) =>
						void setStatusParam(next === "all" ? null : next)
					}
				>
					<TabsList variant="line">
						{STATUS_TABS.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<div className="ml-auto flex items-center gap-2">
					<ToggleGroup
						type="single"
						value={view}
						onValueChange={(next) => next && setView(next as typeof view)}
					>
						<ToggleGroupItem value="month">Month</ToggleGroupItem>
						<ToggleGroupItem value="week">Week</ToggleGroupItem>
					</ToggleGroup>
					<Button variant="outline" size="sm" onClick={() => shift(-1)}>
						‹
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setAnchor(todayUtc())}
					>
						Today
					</Button>
					<Button variant="outline" size="sm" onClick={() => shift(1)}>
						›
					</Button>
					<span className="text-sm font-medium">{rangeLabel}</span>
					{viewToggle}
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-border">
				<div className="grid grid-cols-7 border-b border-border">
					{WEEKDAY_LABELS.map((label) => (
						<div
							key={label}
							className="px-2 py-1 text-xs text-muted-foreground"
						>
							{label}
						</div>
					))}
				</div>
				{weeks.map((week) => {
					const weekStart = week[0];
					if (!weekStart) return null;
					const { bars, overflow } = layoutWeek(spans, weekStart, maxLanes);
					return (
						<div
							key={dayKey(weekStart)}
							className="relative grid grid-cols-7 border-b border-border"
							style={{ minHeight: view === "week" ? "20rem" : "7.5rem" }}
						>
							{week.map((day, index) => (
								<DayCell
									key={dayKey(day)}
									day={day}
									inAnchorMonth={
										view !== "month" ||
										day.getUTCMonth() === anchor.getUTCMonth()
									}
									isToday={dayKey(day) === todayKey}
									overflowCount={overflow[index] ?? 0}
									overflowProjects={spans.filter(
										(span) =>
											span.startDay.getTime() <= day.getTime() &&
											span.endDay.getTime() >= day.getTime(),
									)}
								/>
							))}
							<div className="pointer-events-none col-span-7 row-start-1 grid grid-cols-7 pt-7">
								{bars.map((bar) => (
									<ProjectBar key={bar.task.id} bar={bar} />
								))}
							</div>
						</div>
					);
				})}
			</div>

			{!projects.isPending && spans.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No projects in this range. Start one from a deal.
				</p>
			) : null}
		</div>
	);
}

function projectLabel(span: ProjectSpan): string {
	if (span.status === "COMPLETE") return `✓ ${span.name}`;
	if (span.status === "ON_HOLD") return `${span.name} · On hold`;
	return span.name;
}

function ProjectBar({ bar }: { bar: WeekBar<ProjectSpan> }) {
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const span = bar.task;

	return (
		<button
			type="button"
			onClick={() => router.push(workspaceUrl(`/projects/${span.id}`))}
			title={`${span.name} — ${span.dealName}`}
			style={{
				gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
				marginTop: `${bar.lane * 1.75}rem`,
			}}
			className={cn(
				"pointer-events-auto flex h-6 items-center gap-1 truncate rounded-sm border px-1.5 text-left text-xs",
				NO_CREW_CLASSES.bar,
				"cursor-pointer hover:bg-accent",
				span.status === "COMPLETE" && "opacity-60",
				bar.clippedStart && "rounded-l-none border-l-0",
				bar.clippedEnd && "rounded-r-none border-r-0",
			)}
		>
			<span className="truncate">{projectLabel(span)}</span>
		</button>
	);
}

function DayCell({
	day,
	inAnchorMonth,
	isToday,
	overflowCount,
	overflowProjects,
}: {
	day: Date;
	inAnchorMonth: boolean;
	isToday: boolean;
	overflowCount: number;
	overflowProjects: ProjectSpan[];
}) {
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();

	return (
		<div
			className={cn(
				"flex flex-col gap-1 border-r border-border p-1 last:border-r-0",
				!inAnchorMonth && "bg-muted/30 text-muted-foreground",
			)}
		>
			<span
				className={cn(
					"flex h-5 w-5 items-center justify-center rounded-full text-xs",
					isToday && "font-medium text-primary ring-2 ring-primary",
				)}
			>
				{day.getUTCDate()}
			</span>
			{overflowCount > 0 ? (
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="mt-auto self-start text-xs text-muted-foreground hover:text-foreground"
						>
							+{overflowCount} more
						</button>
					</PopoverTrigger>
					<PopoverContent align="start" className="flex flex-col gap-1">
						{overflowProjects.map((span) => (
							<button
								key={span.id}
								type="button"
								onClick={() =>
									router.push(workspaceUrl(`/projects/${span.id}`))
								}
								className="truncate rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent"
							>
								{projectLabel(span)}
							</button>
						))}
					</PopoverContent>
				</Popover>
			) : null}
		</div>
	);
}
