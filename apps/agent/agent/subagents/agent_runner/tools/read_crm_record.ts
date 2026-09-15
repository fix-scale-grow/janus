import { defineTool } from "eve/tools";
import { z } from "zod";
import { refusal, sessionPrincipal } from "../../../lib/access";
import { readRunRecord } from "../../../lib/run-runtime";
import { requireTeamAgentAttribute } from "../../../lib/session-purpose";

export default defineTool({
	description:
		"Read one approved CRM record with its CRM history and only the connected email or calendar sources approved by this version.",
	inputSchema: z.object({
		kind: z.enum(["contact", "deal"]),
		id: z.string().min(1),
	}),
	async execute(input, ctx) {
		const runId = requireTeamAgentAttribute(ctx, "runId");
		const p = await sessionPrincipal(ctx);
		const denied = refusal(
			p,
			input.kind === "contact" ? "contacts" : "deals",
			"VIEW",
		);
		if (denied) return denied;
		return readRunRecord(runId, input, p);
	},
});
