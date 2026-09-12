import { z } from "zod";

const DASHBOARD_SCOPES = ["me", "everyone"] as const;

export const dashboardSummaryInput = z.object({
	scope: z.enum(DASHBOARD_SCOPES).default("me"),
	pipelineId: z.string().optional(),
});

export type DashboardSummaryInput = z.infer<typeof dashboardSummaryInput>;

export const dashboardPipelineBoardInput = z.object({
	pipelineId: z.string().min(1),
});

export type DashboardPipelineBoardInput = z.infer<
	typeof dashboardPipelineBoardInput
>;
