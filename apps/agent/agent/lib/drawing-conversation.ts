import { db } from "@crm/db";
import { type AccessContext, automationRequester } from "./access";

export async function fileDrawingCheckConversation(
	ctx: AccessContext,
	drawingId: string,
	sessionId: string,
): Promise<void> {
	try {
		const userId = await automationRequester(ctx);
		if (!userId) return;

		await db.agentConversation.create({
			data: {
				kind: "RECORD",
				drawingId,
				userId,
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
