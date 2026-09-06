import { defineTool } from "eve/tools";
import { z } from "zod";
import { DRAWING_LOOKUP, listDrawings } from "../lib/drawing-lookup";

const LIST_DRAWINGS = {
	limits: { maxQuery: 200 },
} as const;

export default defineTool({
	description:
		"Find drawings by title text, and whether each is attached to a deal, a contact, or neither. Ordered by most recently updated, newest first — work out date words like 'this morning' or 'last week' yourself and pick the right rows from updatedAt. Each row carries the drawing's id, its deal or contact if any, and how many estimates it already has. Free.",
	inputSchema: z.object({
		query: z
			.string()
			.trim()
			.min(1)
			.max(LIST_DRAWINGS.limits.maxQuery)
			.optional()
			.describe(
				"Title text to search for, e.g. 'Marchetti roof'. Omit to list drawings regardless of title.",
			),
		attached: z
			.enum(["any", "none", "deal", "contact"])
			.default("any")
			.describe(
				"Filter by attachment: 'none' for drawings on neither a deal nor a contact, 'deal' or 'contact' for drawings attached to one.",
			),
		limit: z
			.number()
			.int()
			.min(1)
			.max(DRAWING_LOOKUP.limits.maxLimit)
			.default(DRAWING_LOOKUP.limits.defaultLimit),
	}),
	async execute({ query, attached, limit }) {
		return listDrawings({ query, attached, limit });
	},
});
