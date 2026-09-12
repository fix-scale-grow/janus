import { ProjectStatus, ProjectTaskStatus } from "@crm/db";
import { z } from "zod";
import { listInput } from "../trpc/list-input";
import { DAY_MS, PROJECTS } from "./projects.config";

export function toDay(value: Date): Date {
	return new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);
}

const dayInput = z.coerce.date().transform(toDay);

export function spanDays(startDay: Date, endDay: Date): number {
	return Math.round((endDay.getTime() - startDay.getTime()) / DAY_MS) + 1;
}

function checkSpan(
	value: { startDay?: Date | null; endDay?: Date | null },
	ctx: z.RefinementCtx,
) {
	const startDay = value.startDay ?? null;
	const endDay = value.endDay ?? null;
	if ((startDay === null) !== (endDay === null)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "A task needs both a start day and an end day, or neither.",
		});
		return;
	}
	if (startDay && endDay) {
		if (endDay.getTime() < startDay.getTime()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The end day is before the start day.",
			});
		} else if (spanDays(startDay, endDay) > PROJECTS.task.maxSpanDays) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `A task spans at most ${PROJECTS.task.maxSpanDays} days.`,
			});
		}
	}
}

const statusEnum = z.enum(
	Object.values(ProjectStatus) as [ProjectStatus, ...ProjectStatus[]],
);
const taskStatusEnum = z.enum(
	Object.values(ProjectTaskStatus) as [
		ProjectTaskStatus,
		...ProjectTaskStatus[],
	],
);

export const projectListInput = listInput.extend({
	dealId: z.string().optional(),
	status: statusEnum.optional(),
});

export type ProjectListInput = z.infer<typeof projectListInput>;

export const projectCalendarInput = z
	.object({
		from: dayInput,
		to: dayInput,
		status: statusEnum.optional(),
	})
	.superRefine((value, ctx) => {
		if (value.to.getTime() < value.from.getTime()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The end of the range is before the start.",
			});
		} else if (
			spanDays(value.from, value.to) > PROJECTS.calendar.maxRangeDays
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `A calendar range spans at most ${PROJECTS.calendar.maxRangeDays} days.`,
			});
		}
	});

export type ProjectCalendarInput = z.infer<typeof projectCalendarInput>;

export const projectIdInput = z.object({ id: z.string().min(1) });

export type ProjectIdInput = z.infer<typeof projectIdInput>;

export const projectCreateInput = z.object({
	dealId: z.string().min(1).optional(),
	contactId: z.string().min(1).optional(),
	name: z.string().trim().min(1).max(PROJECTS.project.nameMax),
	goal: z.string().trim().max(PROJECTS.project.goalMax).optional(),
	startDate: dayInput,
	goalDate: dayInput.optional(),
});

export type ProjectCreateInput = z.infer<typeof projectCreateInput>;

export const projectUpdateInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.project.nameMax).optional(),
	goal: z.string().trim().max(PROJECTS.project.goalMax).nullable().optional(),
	status: statusEnum.optional(),
	startDate: dayInput.optional(),
	goalDate: dayInput.nullable().optional(),
	dealId: z.string().min(1).nullable().optional(),
	contactId: z.string().min(1).nullable().optional(),
	estimateId: z.string().min(1).nullable().optional(),
	invoiceId: z.string().min(1).nullable().optional(),
});

export type ProjectUpdateInput = z.infer<typeof projectUpdateInput>;

export const projectMoveScheduleInput = z.object({
	id: z.string().min(1),
	deltaDays: z
		.number()
		.int()
		.min(-PROJECTS.calendar.moveMaxDays)
		.max(PROJECTS.calendar.moveMaxDays)
		.refine((value) => value !== 0, {
			message: "The move is zero days.",
		}),
});

export type ProjectMoveScheduleInput = z.infer<typeof projectMoveScheduleInput>;

export const taskCreateInput = z
	.object({
		projectId: z.string().min(1),
		name: z.string().trim().min(1).max(PROJECTS.task.nameMax),
		startDay: dayInput.nullable().optional(),
		endDay: dayInput.nullable().optional(),
		crewId: z.string().optional(),
		assigneeId: z.string().optional(),
		note: z.string().trim().max(PROJECTS.task.noteMax).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.endDay && !value.startDay) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "An end day needs a start day.",
			});
			return;
		}
		checkSpan(
			{ startDay: value.startDay, endDay: value.endDay ?? value.startDay },
			ctx,
		);
	})
	.transform((value) => ({
		...value,
		endDay: value.endDay ?? value.startDay ?? null,
	}));

export type TaskCreateInput = z.infer<typeof taskCreateInput>;

export const taskUpdateInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.task.nameMax).optional(),
	note: z.string().trim().max(PROJECTS.task.noteMax).nullable().optional(),
	status: taskStatusEnum.optional(),
	assigneeId: z.string().nullable().optional(),
	crewId: z.string().nullable().optional(),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateInput>;

export const taskMoveInput = z
	.object({
		id: z.string().min(1),
		startDay: dayInput.nullable(),
		endDay: dayInput.nullable(),
		sortOrder: z.number().int().min(0),
	})
	.superRefine(checkSpan);

export type TaskMoveInput = z.infer<typeof taskMoveInput>;
