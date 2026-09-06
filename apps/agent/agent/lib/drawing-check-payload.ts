import { z } from "zod";

const drawingCheckPayloadSchema = z.object({
	estimateId: z.string().trim().min(1),
});

export type DrawingCheckPayload = z.infer<typeof drawingCheckPayloadSchema>;

export function parseDrawingCheckPayload(
	payload: unknown,
): DrawingCheckPayload | null {
	const parsed = drawingCheckPayloadSchema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}
