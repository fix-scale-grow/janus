import { z } from "zod";

const taskRequesterSchema = z.looseObject({
	requestedById: z.string().trim().min(1).optional(),
});

export function parseTaskRequester(payload: unknown): string | null {
	if (payload === null || typeof payload !== "object") return null;
	const parsed = taskRequesterSchema.safeParse(payload);
	if (!parsed.success) {
		throw new Error(
			`This task's requestedById is unreadable: ${parsed.error.issues
				.map((issue) => issue.message)
				.join("; ")}`,
		);
	}
	return parsed.data.requestedById ?? null;
}
