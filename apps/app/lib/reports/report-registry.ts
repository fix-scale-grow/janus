import type { ComponentType } from "react";
import { ArAgingReport } from "@/components/reports/reports/ar-aging";
import { CostBreakdownReport } from "@/components/reports/reports/cost-breakdown";
import { JobProfitabilityReport } from "@/components/reports/reports/job-profitability";
import { ProfitOverTimeReport } from "@/components/reports/reports/profit-over-time";

export const REPORT_IDS = [
	"job-profitability",
	"profit-over-time",
	"cost-breakdown",
	"ar-aging",
	"leaderboard",
	"pipeline",
	"lead-sources",
	"production",
	"permits",
] as const;

export type ReportId = (typeof REPORT_IDS)[number];

export function isReportId(value: string): value is ReportId {
	return (REPORT_IDS as readonly string[]).includes(value);
}

export type ReportMeta = {
	id: ReportId;
	title: string;
	description: string;
	money: boolean;
	component?: ComponentType;
};

export const REPORT_REGISTRY: ReportMeta[] = [
	{
		id: "job-profitability",
		title: "Job profitability",
		description:
			"Invoiced, collected, costs and margin per deal, rolled up by client.",
		money: true,
		component: JobProfitabilityReport,
	},
	{
		id: "profit-over-time",
		title: "Profit over time",
		description: "Invoiced vs. collected vs. costs, by month.",
		money: true,
		component: ProfitOverTimeReport,
	},
	{
		id: "cost-breakdown",
		title: "Cost breakdown",
		description: "Spend by category, deal and creator, over a date range.",
		money: true,
		component: CostBreakdownReport,
	},
	{
		id: "ar-aging",
		title: "AR aging",
		description: "Outstanding invoices, bucketed by how overdue they are.",
		money: true,
		component: ArAgingReport,
	},
	{
		id: "leaderboard",
		title: "Sales leaderboard",
		description: "Win rate, deals moved and activity logged, by owner.",
		money: false,
	},
	{
		id: "pipeline",
		title: "Pipeline win/loss",
		description: "Win rate, loss reasons and velocity, by stage.",
		money: false,
	},
	{
		id: "lead-sources",
		title: "Lead sources",
		description: "Contacts and deals by source, with form conversion.",
		money: false,
	},
	{
		id: "production",
		title: "Production and crews",
		description: "Throughput by production stage and by crew.",
		money: false,
	},
	{
		id: "permits",
		title: "Permits",
		description:
			"Status, turnaround time by jurisdiction and inspection pass rate.",
		money: false,
	},
];

export function reportMeta(id: string): ReportMeta | undefined {
	return REPORT_REGISTRY.find((report) => report.id === id);
}
