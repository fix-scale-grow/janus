import { defineTool } from "eve/tools";
import { z } from "zod";
import { isAutomated } from "../lib/approval";
import { attachDrawing } from "../lib/drawing-writes";
import { assertResearchPurpose } from "../lib/session-purpose";

export default defineTool({
	description:
		"Attach a drawing to a deal or a contact, or detach it by passing null for that field. Reversible, so no person needs to approve it. If the drawing already belongs to a different deal or contact than the one given, this refuses and tells you to ask the rep first — call again with confirmReplace: true only once they say to move it. Not available to unattended sessions.",
	inputSchema: z.object({
		drawingId: z.cuid(),
		dealId: z
			.cuid()
			.nullable()
			.optional()
			.describe("Set the deal, or null to detach. Omit to leave unchanged."),
		contactId: z
			.cuid()
			.nullable()
			.optional()
			.describe("Set the contact, or null to detach. Omit to leave unchanged."),
		confirmReplace: z
			.boolean()
			.optional()
			.describe(
				"Set true only after the rep has confirmed replacing an existing different deal or contact.",
			),
	}),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);

		if (isAutomated(ctx.session)) {
			return {
				attached: false as const,
				reason:
					"Not something to do unattended. A rep must ask for this in a conversation.",
			};
		}

		return attachDrawing(input);
	},
});
