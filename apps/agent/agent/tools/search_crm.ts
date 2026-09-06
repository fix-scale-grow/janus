import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchCrm } from "../lib/lookup";

export default defineTool({
	description:
		"Find contacts and deals by name, email address or deal name — the way a person would search. Returns each match with its id, so you never have to ask a rep for one. Free. Use it whenever a question names a record you do not have the id for.",
	inputSchema: z.object({
		query: z
			.string()
			.min(2)
			.describe("A name, an email address, or part of one. 'marchetti'."),
		kinds: z
			.array(z.enum(["contact", "deal"]))
			.optional()
			.describe("Narrow the search. Defaults to both."),
		limit: z.number().int().min(1).max(25).default(10),
	}),
	async execute({ query, kinds, limit }) {
		const result = await searchCrm(query, { kinds, limit });

		return {
			...result,
			note:
				result.total === 0
					? "Nothing in the CRM matches. That is an answer: say so rather than asking the rep to search for you. Try a shorter or differently spelled term first — a surname alone often works where a full name does not."
					: result.total > 1
						? "More than one match. If it is genuinely ambiguous, name the candidates and ask which — never ask for an id."
						: undefined,
		};
	},
});
