import { defineTool } from "eve/tools";
import { z } from "zod";
import { reviewDrawing } from "../lib/drawing-review";

export default defineTool({
	description:
		"Analyze a drawing's takeoff: shapes drawn but not assigned to a service, shapes tagged with a service but too small or unscaled to measure, and a related service the price book offers — disposal, underlayment, a permit — that is missing from the estimate generated from this drawing. Pass estimateId when a specific estimate was named; otherwise the drawing's most recently generated estimate is used. Free, read-only, no approval needed. Raise what it finds as questions for the rep to check, never as corrections or assertions.",
	inputSchema: z.object({
		drawingId: z.string(),
		estimateId: z.string().optional(),
	}),
	async execute({ drawingId, estimateId }) {
		return reviewDrawing(drawingId, estimateId);
	},
});
