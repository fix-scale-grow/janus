"use client";

import { StatCard } from "@crm/ui/components/stat-card";
import { cn } from "@crm/ui/lib/utils";
import type { ReportKpi, ReportKpiTone } from "@/lib/reports/types";

const TONE_CLASS: Record<ReportKpiTone, string> = {
	default: "",
	warning: "text-warning",
	destructive: "text-destructive",
};

export function KpiRow({ kpis }: { kpis: ReportKpi[] }) {
	if (kpis.length === 0) return null;

	return (
		<div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
			{kpis.map((kpi) => (
				<StatCard
					key={kpi.key}
					label={kpi.label}
					value={
						<span className={cn(TONE_CLASS[kpi.tone ?? "default"])}>
							{kpi.value}
						</span>
					}
					className="bg-card"
				/>
			))}
		</div>
	);
}
