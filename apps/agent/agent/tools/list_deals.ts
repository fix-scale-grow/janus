import { defineTool } from "eve/tools";
import { z } from "zod";
import { refusal, sessionPrincipal } from "../lib/access";
import { listDeals } from "../lib/lookup";

export default defineTool({
	description:
		"List deals across the CRM with pipeline status and inactivity filters. Use this for broad requests such as all open deals, stale deals, deals untouched for a number of days, or a pipeline sweep. Results are oldest-touch first and paginated; continue with nextCursor while hasMore is true. Free.",
	inputSchema: z.object({
		status: z.enum(["open", "won", "lost", "all"]).default("open"),
		inactiveForDays: z
			.number()
			.int()
			.min(0)
			.max(3650)
			.optional()
			.describe(
				"Return deals whose last activity was at least this many days ago. Deals with no activity qualify once they are this old.",
			),
		ownerId: z.string().optional(),
		limit: z.number().int().min(1).max(100).default(50),
		cursor: z.string().optional(),
	}),
	async execute(input, ctx) {
		const p = await sessionPrincipal(ctx);
		const denied = refusal(p, "deals", "VIEW");
		if (denied) return denied;
		return listDeals(input, p);
	},
	toModelOutput(output) {
		if ("refused" in output) return { type: "json", value: output };
		return {
			type: "json",
			value: {
				...output,
				deals: output.deals.map((deal) => ({
					...deal,
					owner: deal.owner
						? {
								id: deal.owner.id,
								name: deal.owner.name,
								email: deal.owner.email,
							}
						: null,
				})),
			},
		};
	},
});
