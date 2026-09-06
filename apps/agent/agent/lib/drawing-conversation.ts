import { db } from "@crm/db";

export async function fileDrawingCheckConversation(
	drawingId: string,
	sessionId: string,
): Promise<void> {
	try {
		const drawing = await db.drawing.findUnique({
			where: { id: drawingId },
			select: { createdById: true },
		});
		if (!drawing) return;

		await db.agentConversation.create({
			data: {
				kind: "RECORD",
				drawingId,
				userId: drawing.createdById,
				sessionId,
				title: "Drawing review",
				lastMessageAt: new Date(),
			},
		});
	} catch (error) {
		console.warn("[agent] could not file a drawing review conversation", {
			drawingId,
			reason: error instanceof Error ? error.message : String(error),
		});
	}
}
