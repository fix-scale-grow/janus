import { defineTool } from "eve/tools";
import { z } from "zod";
import { sensitiveWrite } from "../lib/approval";
import { applyDrawingTags } from "../lib/drawing-writes";
import { assertResearchPurpose } from "../lib/session-purpose";

const tag = z.object({
	scopeId: z.string().trim().min(1).max(128),
	shapeLabel: z.string().trim().min(1).max(120),
	serviceId: z.cuid(),
	serviceName: z.string().trim().min(1).max(120),
	reason: z.string().trim().min(1).max(280),
});

export default defineTool({
	description:
		"Propose a service for one or more shapes on a drawing, from scopeIds read_drawing already reported. A person approves before anything changes — draft each tag with the shape's own label, the service it should price against, and why.",
	inputSchema: z.object({
		drawingId: z.cuid(),
		tags: z.array(tag).min(1).max(50),
	}),
	approval: sensitiveWrite(
		"Propose the tags in chat instead and let a rep assign the services from the drawing editor.",
	),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);

		return applyDrawingTags(
			input.drawingId,
			input.tags.map((entry) => ({
				scopeId: entry.scopeId,
				serviceId: entry.serviceId,
			})),
		);
	},
});
