"use client";

import ReportIcon from "@carbon/icons-react/es/Report";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { DrillTable } from "@/components/reports/drill-table";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { KpiRow } from "@/components/reports/kpi-row";
import { RangeControl } from "@/components/reports/range-control";
import type { ReportMeta } from "@/lib/reports/report-registry";

export function ReportPage({ meta }: { meta: ReportMeta }) {
	if (meta.component) {
		const Component = meta.component;
		return <Component />;
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton columns={[]} rows={[]} filename={`${meta.id}.csv`} />
			</div>

			<KpiRow kpis={[]} />

			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={ReportIcon} />
					</EmptyMedia>
					<EmptyTitle>Report coming in this build</EmptyTitle>
					<EmptyDescription>
						{meta.title} is registered but not wired up to data yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>

			<DrillTable<{ id: string }> columns={[]} rows={[]} />
		</div>
	);
}
