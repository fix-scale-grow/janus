import { defineTool } from "eve/tools";
import { z } from "zod";
import { refusal, sessionPrincipal } from "../lib/access";
import { readCrmHistory } from "../lib/crm";
import { focusOn } from "../lib/focus";

export default defineTool({
	description:
		"Read everything the CRM already has on a contact: email threads with full message bodies, meetings, whether they have ever replied, and the deals they are on. Free, fast, and the best evidence there is — call it before paying for a lookup.",
	inputSchema: z.object({
		contactId: z.string(),
		threads: z
			.number()
			.int()
			.min(1)
			.max(20)
			.default(5)
			.describe("How many recent threads to read."),
	}),
	async execute({ contactId, threads }, ctx) {
		const p = await sessionPrincipal(ctx);
		const denied = refusal(p, "contacts", "VIEW");
		if (denied) return denied;

		const history = await readCrmHistory(contactId, { threads }, p);
		if (!history) return { found: false as const, reason: "No such contact." };
		focusOn({ contactId });

		const evidence =
			history.stats.emails === 0 && history.stats.meetings === 0
				? "We have never actually spoken to this person. Nothing here is evidence of anything."
				: "A signature block or a reply from their own address is primary evidence — record it as `crm.signature-block` or `crm.thread-reply`.";

		return {
			found: true as const,
			...history,
			note: evidence,
		};
	},
});
