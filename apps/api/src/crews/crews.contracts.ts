import { z } from "zod";
import { CREWS } from "./crews.config";

export const crewColorEnum = z.enum(CREWS.colors);

export const crewCreateInput = z.object({
	name: z.string().trim().min(1).max(CREWS.nameMax),
	color: crewColorEnum,
});
export type CrewCreateInput = z.infer<typeof crewCreateInput>;

export const crewUpdateInput = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(CREWS.nameMax).optional(),
	color: crewColorEnum.optional(),
	archived: z.boolean().optional(),
});
export type CrewUpdateInput = z.infer<typeof crewUpdateInput>;

export const crewIdInput = z.object({ id: z.string().min(1) });
