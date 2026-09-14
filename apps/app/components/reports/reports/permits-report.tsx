"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { DonutStat } from "@/components/dashboard-charts";
import { LocalDay } from "@/components/local-date-time";
import {
	DrillTable,
	type DrillTableColumn,
} from "@/components/reports/drill-table";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { KpiRow } from "@/components/reports/kpi-row";
import { RangeControl } from "@/components/reports/range-control";
import {
	PERMIT_STATUS_LABEL,
	PERMIT_TYPE_LABEL,
	type PermitStatus,
	type PermitType,
} from "@/lib/permits/permit-status";
import { effectiveRange, reportRangeParsers } from "@/lib/reports/range";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type CycleRow =
	RouterOutputs["reports"]["permits"]["cycleDaysByJurisdiction"][number] & {
		id: string;
	};
type ExpiringRow = RouterOutputs["reports"]["permits"]["expiring"][number] & {
	id: string;
};

const STATUS_COLORS: Record<string, string> = {
	DRAFT: "var(--muted-foreground)",
	READY_TO_SUBMIT: "var(--chart-4)",
	SUBMITTED: "var(--chart-2)",
	ISSUED: "var(--chart-3)",
	DENIED: "var(--destructive)",
	EXPIRED: "var(--warning)",
	INSPECTIONS: "var(--chart-1)",
	CLOSED: "var(--chart-5)",
};

function statusLabel(status: string): string {
	return PERMIT_STATUS_LABEL[status as PermitStatus] ?? status;
}

function permitTypeLabel(type: string): string {
	return PERMIT_TYPE_LABEL[type as PermitType] ?? type;
}

export function PermitsReport() {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(trpc.reports.permits.queryOptions({ from, to }));

	const statusCounts = data?.statusCounts ?? [];
	const cycleRows: CycleRow[] = (data?.cycleDaysByJurisdiction ?? []).map(
		(row) => ({ ...row, id: row.jurisdictionId }),
	);
	const expiringRows: ExpiringRow[] = (data?.expiring ?? []).map((row) => ({
		...row,
		id: row.permitId,
	}));
	const hasStatusData = statusCounts.length > 0;
	const totalPermits = statusCounts.reduce((sum, row) => sum + row.count, 0);

	const cycleColumns: DrillTableColumn<CycleRow>[] = [
		{
			id: "jurisdiction",
			header: "Jurisdiction",
			width: "w-[60%]",
			render: (row) => row.jurisdictionName,
		},
		{
			id: "avgDays",
			header: "Avg days submitted to issued",
			align: "right",
			width: "w-[40%]",
			render: (row) => `${row.avgDays.toFixed(1)}d`,
		},
	];

	const expiringColumns: DrillTableColumn<ExpiringRow>[] = [
		{
			id: "deal",
			header: "Deal",
			width: "w-[35%]",
			render: (row) => (
				<button
					type="button"
					onClick={() =>
						openRecord({ kind: "deal", id: row.dealId }, { tab: "permits" })
					}
					className="text-foreground hover:underline"
				>
					{row.dealName}
				</button>
			),
		},
		{
			id: "type",
			header: "Permit type",
			width: "w-[25%]",
			render: (row) => permitTypeLabel(row.permitType),
		},
		{
			id: "expires",
			header: "Expires",
			width: "w-[20%]",
			render: (row) => <LocalDay date={row.expiresAt} />,
		},
	];

	const csvColumns = [
		{ key: "deal", label: "Deal" },
		{ key: "type", label: "Permit type" },
		{ key: "expires", label: "Expires" },
	];
	const csvRows = expiringRows.map((row) => ({
		deal: row.dealName,
		type: permitTypeLabel(row.permitType),
		expires: row.expiresAt.slice(0, 10),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="permits-expiring.csv"
				/>
			</div>

			<KpiRow kpis={data?.kpis ?? []} />

			{hasStatusData ? (
				<div className="rounded-lg border p-4">
					<DonutStat
						data={statusCounts.map((row) => ({
							key: row.status,
							label: statusLabel(row.status),
							value: row.count,
							color: STATUS_COLORS[row.status] ?? "var(--chart-1)",
						}))}
						height={220}
						centerValue={String(totalPermits)}
						centerLabel="Permits"
					/>
				</div>
			) : null}

			<div className="flex flex-col gap-6">
				<DrillTable<CycleRow>
					columns={cycleColumns}
					rows={cycleRows}
					emptyTitle="No issued permits in this range"
				/>
				<DrillTable<ExpiringRow>
					columns={expiringColumns}
					rows={expiringRows}
					emptyTitle="No permits expiring soon"
				/>
			</div>
		</div>
	);
}
