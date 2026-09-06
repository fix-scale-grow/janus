import { ProjectStatus, ProjectTaskStatus } from "@crm/db";
import { z } from "zod";
import { listInput } from "../trpc/list-input";
import { PROJECTS } from "./projects.config";

export function toDay(value: Date): Date {
	return new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);
}

const dayInput = z.coerce.date().transform(toDay);

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

export const projectIdInput = z.object({ id: z.string().min(1) });

export type ProjectIdInput = z.infer<typeof projectIdInput>;

export const projectCreateInput = z.object({
	dealId: z.string().min(1),
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
});

export type ProjectUpdateInput = z.infer<typeof projectUpdateInput>;

export const taskCreateInput = z.object({
	projectId: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.task.nameMax),
	day: dayInput.nullable().optional(),
	assigneeId: z.string().optional(),
	note: z.string().trim().max(PROJECTS.task.noteMax).optional(),
});

export type TaskCreateInput = z.infer<typeof taskCreateInput>;

export const taskUpdateInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(PROJECTS.task.nameMax).optional(),
	note: z.string().trim().max(PROJECTS.task.noteMax).nullable().optional(),
	status: taskStatusEnum.optional(),
	assigneeId: z.string().nullable().optional(),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateInput>;

export const taskMoveInput = z.object({
	id: z.string().min(1),
	day: dayInput.nullable(),
	sortOrder: z.number().int().min(0),
});

export type TaskMoveInput = z.infer<typeof taskMoveInput>;
