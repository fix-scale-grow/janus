import type { AccessPrincipal } from "@crm/db/access-policy";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { AGENT_ACCESS, sessionPrincipal, writeGuard } from "../lib/access";
import { sensitiveWrite } from "../lib/approval";
import { archiveField } from "../lib/fields";

const toolInput = z.object({
	entity: z.enum(["CONTACT", "DEAL"]),
	key: z.string().describe("The field's key, as list_fields reports it."),
});

const blockedFor = async (p: AccessPrincipal) =>
	p.isAdmin ? null : AGENT_ACCESS.adminOnlyFields;

export default defineTool({
	description:
		"Archive a custom field. It leaves every sheet and table and stops being filled; the values already recorded are kept. A schema change every rep will see, so it needs a person.",
	inputSchema: toolInput,
	approval: sensitiveWrite(
		"Say which field you would archive and let a rep do it from the Fields sheet.",
		writeGuard(toolInput, blockedFor),
	),
	async execute(input, ctx) {
		const refused = await blockedFor(await sessionPrincipal(ctx));
		if (refused) return { refused };
		return archiveField(input);
	},
});
