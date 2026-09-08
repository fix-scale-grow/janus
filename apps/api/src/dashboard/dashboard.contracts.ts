import { z } from "zod";

const DASHBOARD_SCOPES = ["me", "everyone"] as const;

export const dashboardSummaryInput = z.object({
	scope: z.enum(DASHBOARD_SCOPES).default("me"),
	pipelineId: z.string().optional(),
});

export type DashboardSummaryInput = z.infer<typeof dashboardSummaryInput>;
