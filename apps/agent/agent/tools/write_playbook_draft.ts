import { defineTool } from "eve/tools";
import { z } from "zod";
import {
	draftPlaybookFacts,
	jurisdictionInput,
	permitTypeEnum,
	writePlaybookDraft,
} from "../lib/permit-research";
import { assertResearchPurpose } from "../lib/session-purpose";

export default defineTool({
	description:
		"Draft facts for a jurisdiction's permit playbook — when it is needed, who may pull it, prerequisites, how to apply, the fee schedule, typical turnaround, the required documents and the inspections. Every fact must carry the exact official page you read it on: a fact with no sourceUrl is refused, not stored. Everything written here lands unverified, for a person to check against the source before anyone relies on it. Never overwrites a fact a person has already verified.",
	inputSchema: z.object({
		jurisdiction: jurisdictionInput,
		permitType: permitTypeEnum,
		typeLabel: z.string().trim().max(160).optional(),
		facts: draftPlaybookFacts,
	}),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);

		return writePlaybookDraft({
			jurisdiction: input.jurisdiction,
			permitType: input.permitType,
			typeLabel: input.typeLabel,
			facts: input.facts,
		});
	},
});
