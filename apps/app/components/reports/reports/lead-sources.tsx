"use client";

import { formatMoney } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { DonutStat } from "@/components/dashboard-charts";
import {
	DrillTable,
	type DrillTableColumn,
} from "@/components/reports/drill-table";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { KpiRow } from "@/components/reports/kpi-row";
import { RangeControl } from "@/components/reports/range-control";
import { effectiveRange, reportRangeParsers } from "@/lib/reports/range";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Row = RouterOutputs["reports"]["leadSources"]["rows"][number] & {
	id: string;
};

const DONUT_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export function LeadSourcesReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());

	const { data } = useQuery(
		trpc.reports.leadSources.queryOptions({ from, to }),
	);

	const rows: Row[] = (data?.rows ?? []).map((row) => ({
		...row,
		id: row.source,
	}));
	const hasData = rows.length > 0;
	const moneyVisible = rows.some((row) => row.wonCents !== null);
	const totalContacts = rows.reduce((sum, row) => sum + row.contacts, 0);

	const columns: DrillTableColumn<Row>[] = [
		{
			id: "source",
			header: "Source",
			width: moneyVisible ? "w-[30%]" : "w-[40%]",
			render: (row) => row.source,
		},
		{
			id: "contacts",
			header: "Contacts",
			align: "right",
			width: "w-[20%]",
			render: (row) => String(row.contacts),
		},
		{
			id: "deals",
			header: "Deals",
			align: "right",
			width: "w-[20%]",
			render: (row) => String(row.deals),
		},
		{
			id: "won",
			header: "Won",
			align: "right",
			width: moneyVisible ? "w-[15%]" : "w-[20%]",
			render: (row) => String(row.wonCount),
		},
		...(moneyVisible
			? [
					{
						id: "wonValue",
						header: "Won value",
						align: "right" as const,
						width: "w-[15%]",
						render: (row: Row) => formatMoney(row.wonCents ?? 0, "USD"),
					},
				]
			: []),
	];

	const csvColumns = [
		{ key: "source", label: "Source" },
		{ key: "contacts", label: "Contacts" },
		{ key: "deals", label: "Deals" },
		{ key: "won", label: "Won" },
		...(moneyVisible ? [{ key: "wonValue", label: "Won value" }] : []),
	];
	const csvRows = rows.map((row) => ({
		source: row.source,
		contacts: row.contacts,
		deals: row.deals,
		won: row.wonCount,
		...(moneyVisible
			? { wonValue: formatMoney(row.wonCents ?? 0, "USD") }
			: {}),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<RangeControl />
				<ExportCsvButton
					columns={csvColumns}
					rows={csvRows}
					filename="lead-sources.csv"
				/>
			</div>

			{hasData ? (
				<>
					<KpiRow kpis={data?.kpis ?? []} />
					<div className="rounded-lg border p-4">
						<DonutStat
							data={rows.map((row, index) => ({
								key: row.source,
								label: row.source,
								value: row.contacts,
								color:
									DONUT_COLORS[index % DONUT_COLORS.length] ?? "var(--chart-1)",
							}))}
							height={220}
							centerValue={String(totalContacts)}
							centerLabel="Contacts"
						/>
					</div>
				</>
			) : null}

			<DrillTable<Row> columns={columns} rows={rows} />
		</div>
	);
}
