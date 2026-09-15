import { defineTool } from "eve/tools";
import { z } from "zod";
import { refusal, sessionPrincipal } from "../lib/access";
import { contactsNeedingWork } from "../lib/crm";

export default defineTool({
	description:
		"List CRM contacts with outstanding research: no real name yet, or no background written. Each row says what is missing. Deciding what is worth doing, and in what order, is your job.",
	inputSchema: z.object({
		limit: z.number().int().min(1).max(25).default(10),
	}),
	async execute({ limit }, ctx) {
		const p = await sessionPrincipal(ctx);
		const denied = refusal(p, "contacts", "VIEW");
		if (denied) return denied;
		const contacts = await contactsNeedingWork(limit, p);
		return { count: contacts.length, contacts };
	},
});
