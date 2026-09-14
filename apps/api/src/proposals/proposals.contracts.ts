import { EstimateTier } from "@crm/db/enums";
import { z } from "zod";
import { templateBlocksSchema } from "../templates/template-blocks";
import { PROPOSALS } from "./proposals.config";

const tierEnum = z.enum(
	Object.values(EstimateTier) as [EstimateTier, ...EstimateTier[]],
);

export const proposalForEstimateInput = z.object({
	estimateId: z.string().min(1),
});

export const proposalCreateInput = z.object({
	estimateId: z.string().min(1),
});

export const proposalIdInput = z.object({ id: z.string().min(1) });

export const proposalUpdateInput = z.object({
	id: z.string().min(1),
	data: z.object({
		title: z.string().trim().min(1).max(PROPOSALS.cover.titleMax).optional(),
		coverTitle: z
			.string()
			.trim()
			.max(PROPOSALS.cover.titleMax)
			.nullable()
			.optional(),
		coverSubtitle: z
			.string()
			.trim()
			.max(PROPOSALS.cover.subtitleMax)
			.nullable()
			.optional(),
		body: templateBlocksSchema.optional(),
	}),
});

export const proposalSendInput = z.object({
	id: z.string().min(1),
	to: z.string().trim().email().optional(),
	subject: z.string().trim().min(1).max(300).optional(),
	personalNote: z.string().trim().max(2000).optional(),
});

export const proposalTokenInput = z.object({
	token: z.string().min(1).max(PROPOSALS.viewToken.maxLength),
});

export const proposalAcceptInput = z.object({
	token: z.string().min(1).max(PROPOSALS.viewToken.maxLength),
	tier: tierEnum,
	name: z.string().trim().min(1).max(PROPOSALS.acceptName.max),
});

export type ProposalForEstimateInput = z.infer<typeof proposalForEstimateInput>;
export type ProposalCreateInput = z.infer<typeof proposalCreateInput>;
export type ProposalUpdateInput = z.infer<typeof proposalUpdateInput>;
export type ProposalSendInput = z.infer<typeof proposalSendInput>;
export type ProposalAcceptInput = z.infer<typeof proposalAcceptInput>;
