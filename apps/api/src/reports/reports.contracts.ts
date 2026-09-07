import { z } from "zod";
import { toDay } from "../projects/projects.contracts";

const dayInput = z.coerce.date().transform(toDay);

export const reportRangeInput = z.object({
	from: dayInput.optional(),
	to: dayInput.optional(),
});
export type ReportRangeInput = z.infer<typeof reportRangeInput>;
