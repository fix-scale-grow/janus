import type { AccessPrincipal } from "@crm/db/access-policy";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { sessionPrincipal, targetsBlocked, writeGuard } from "../lib/access";
import { sensitiveWrite } from "../lib/approval";
import { fillWorksheetAnswers } from "../lib/permit-writes";
import { assertResearchPurpose } from "../lib/session-purpose";

const FILL_WORKSHEET = {
	limits: {
		maxAnswers: 80,
	},
} as const;

const toolInput = z.object({
	permitId: z.string(),
	answers: z
		.record(z.string().regex(/^[a-z0-9_]{1,60}$/), z.string().max(4000))
		.refine(
			(value) => Object.keys(value).length <= FILL_WORKSHEET.limits.maxAnswers,
			{
				message: `At most ${FILL_WORKSHEET.limits.maxAnswers} answers per call.`,
			},
		),
});

const blockedFor = (p: AccessPrincipal, input: z.infer<typeof toolInput>) =>
	targetsBlocked(p, [{ kind: "permit", id: input.permitId, need: "EDIT" }]);

export default defineTool({
	description:
		"Fill in fields on a permit's worksheet for a person to review. Every field lands as NEEDS_REVIEW, never approved. A field a person has already approved is left alone, and a key that is not on the permit's live worksheet template is refused.",
	inputSchema: toolInput,
	approval: sensitiveWrite(
		"Ask the rep to run AI fill from the permit worksheet.",
		writeGuard(toolInput, blockedFor),
	),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);

		const blocked = await blockedFor(await sessionPrincipal(ctx), input);
		if (blocked) return { applied: false, reason: blocked };

		const result = await fillWorksheetAnswers(input.permitId, input.answers);
		if (!result.found) return { applied: false, reason: result.reason };

		return {
			applied: true,
			summary: `Filled ${result.filled.length} field${result.filled.length === 1 ? "" : "s"} for review`,
			filled: result.filled,
			skipped: result.skipped,
			permitId: result.permitId,
			dealId: result.dealId,
		};
	},
});
