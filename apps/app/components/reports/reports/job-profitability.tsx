"use client";

import type { ChartConfig } from "@crm/ui/components/chart";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { formatMoney, formatPercent } from "@crm/ui/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { BarTrend } from "@/components/dashboard-charts";
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

type Row = RouterOutputs["reports"]["jobProfitability"]["rows"][number] & {
	id: string;
};

type ClientRow = {
	id: string;
	primaryContactId: string | null;
	primaryContactName: string | null;
	dealCount: number;
	invoicedCents: number;
	collectedCents: number;
	costsCents: number;
	profitCents: number;
	collectedProfitCents: number;
	marginPct: number | null;
};

const CHART_CONFIG: ChartConfig = {
	value: { label: "Profit", color: "var(--chart-1)" },
};

const NO_CONTACT_KEY = "no-contact";

function toClientRows(rows: Row[]): ClientRow[] {
	type Bucket = {
		primaryContactId: string | null;
		primaryContactName: string | null;
		dealCount: number;
		invoicedCents: number;
		collectedCents: number;
		costsCents: number;
		profitCents: number;
		collectedProfitCents: number;
	};
	const buckets = new Map<string, Bucket>();
	for (const row of rows) {
		const key = row.primaryContactId ?? NO_CONTACT_KEY;
		const bucket = buckets.get(key) ?? {
			primaryContactId: row.primaryContactId,
			primaryContactName: row.primaryContactName,
			dealCount: 0,
			invoicedCents: 0,
			collectedCents: 0,
			costsCents: 0,
			profitCents: 0,
			collectedProfitCents: 0,
		};
		bucket.dealCount += 1;
		bucket.invoicedCents += row.invoicedCents;
		bucket.collectedCents += row.collectedCents;
		bucket.costsCents += row.costsCents;
		bucket.profitCents += row.profitCents;
		bucket.collectedProfitCents += row.collectedProfitCents;
		buckets.set(key, bucket);
	}
	return [...buckets.entries()]
		.map(([key, bucket]) => ({
			id: key,
			primaryContactId: bucket.primaryContactId,
			primaryContactName: bucket.primaryContactName,
			dealCount: bucket.dealCount,
			invoicedCents: bucket.invoicedCents,
			collectedCents: bucket.collectedCents,
			costsCents: bucket.costsCents,
			profitCents: bucket.profitCents,
			collectedProfitCents: bucket.collectedProfitCents,
			marginPct:
				bucket.invoicedCents > 0
					? (bucket.profitCents / bucket.invoicedCents) * 100
					: null,
		}))
		.sort((a, b) => b.profitCents - a.profitCents);
}

export function JobProfitabilityReport() {
	const trpc = useTRPC();
	const [range] = useQueryStates(reportRangeParsers);
	const { from, to } = effectiveRange(range, new Date());
	const [view, setView] = useState<"deals" | "clients">("deals");

	const { data } = useQuery(
		trpc.reports.jobProfitability.queryOptions({ from, to }),
	);

	const rows: Row[] = (data?.rows ?? []).map((row) => ({
		...row,
		id: row.dealId,
	}));
	const clientRows = toClientRows(rows);
	const hasData = rows.length > 0;

	const dealColumns: DrillTableColumn<Row>[] = [
		{
			id: "deal",
			header: "Deal",
			width: "w-[22%]",
			render: (row) => (
				<RecordLink kind="deal" id={row.dealId} className="text-foreground">
					{row.dealName} #{row.dealNumber}
				</RecordLink>
			),
		},
		{
			id: "contact",
			header: "Client",
			width: "w-[16%]",
			render: (row) =>
				row.primaryContactId ? (
					<RecordLink kind="contact" id={row.primaryContactId}>
						{row.primaryContactName || "Unnamed contact"}
					</RecordLink>
				) : (
					<span className="text-muted-foreground">No contact</span>
				),
		},
		{
			id: "invoiced",
			header: "Invoiced",
			align: "right",
			width: "w-[11%]",
			render: (row) => formatMoney(row.invoicedCents, "USD"),
		},
		{
			id: "collected",
			header: "Collected",
			align: "right",
			width: "w-[11%]",
			render: (row) => formatMoney(row.collectedCents, "USD"),
		},
		{
			id: "costs",
			header: "Costs",
			align: "right",
			width: "w-[11%]",
			render: (row) => formatMoney(row.costsCents, "USD"),
		},
		{
			id: "profit",
			header: "Profit",
			align: "right",
			width: "w-[11%]",
			render: (row) => (
				<span className={row.profitCents < 0 ? "text-destructive" : undefined}>
					{formatMoney(row.profitCents, "USD")}
				</span>
			),
		},
		{
			id: "collectedProfit",
			header: "Collected profit",
			align: "right",
			width: "w-[12%]",
			render: (row) => (
				<span
					className={
						row.collectedProfitCents < 0 ? "text-destructive" : undefined
					}
				>
					{formatMoney(row.collectedProfitCents, "USD")}
				</span>
			),
		},
		{
			id: "margin",
			header: "Margin",
			align: "right",
			width: "w-[6%]",
			render: (row) =>
				row.marginPct === null ? "—" : formatPercent(row.marginPct / 100),
		},
	];

	const clientColumns: DrillTableColumn<ClientRow>[] = [
		{
			id: "client",
			header: "Client",
			width: "w-[24%]",
			render: (row) =>
				row.primaryContactId ? (
					<RecordLink kind="contact" id={row.primaryContactId}>
						{row.primaryContactName || "Unnamed contact"}
					</RecordLink>
				) : (
					<span className="text-muted-foreground">No contact</span>
				),
		},
		{
			id: "deals",
			header: "Deals",
			align: "right",
			width: "w-[10%]",
			render: (row) => String(row.dealCount),
		},
		{
			id: "invoiced",
			header: "Invoiced",
			align: "right",
			width: "w-[12%]",
			render: (row) => formatMoney(row.invoicedCents, "USD"),
		},
		{
			id: "collected",
			header: "Collected",
			align: "right",
			width: "w-[12%]",
			render: (row) => formatMoney(row.collectedCents, "USD"),
		},
		{
			id: "costs",
			header: "Costs",
			align: "right",
			width: "w-[12%]",
			render: (row) => formatMoney(row.costsCents, "USD"),
		},
		{
			id: "profit",
			header: "Profit",
			align: "right",
			width: "w-[12%]",
			render: (row) => (
				<span className={row.profitCents < 0 ? "text-destructive" : undefined}>
					{formatMoney(row.profitCents, "USD")}
				</span>
			),
		},
		{
			id: "collectedProfit",
			header: "Collected profit",
			align: "right",
			width: "w-[12%]",
			render: (row) => (
				<span
					className={
						row.collectedProfitCents < 0 ? "text-destructive" : undefined
					}
				>
					{formatMoney(row.collectedProfitCents, "USD")}
				</span>
			),
		},
		{
			id: "margin",
			header: "Margin",
			align: "right",
			width: "w-[6%]",
			render: (row) =>
				row.marginPct === null ? "—" : formatPercent(row.marginPct / 100),
		},
	];

	const dealCsvColumns = [
		{ key: "deal", label: "Deal" },
		{ key: "client", label: "Client" },
		{ key: "invoiced", label: "Invoiced" },
		{ key: "collected", label: "Collected" },
		{ key: "costs", label: "Costs" },
		{ key: "profit", label: "Profit" },
		{ key: "collectedProfit", label: "Collected profit" },
		{ key: "margin", label: "Margin" },
	];
	const dealCsvRows = rows.map((row) => ({
		deal: `${row.dealName} #${row.dealNumber}`,
		client: row.primaryContactName || "",
		invoiced: formatMoney(row.invoicedCents, "USD"),
		collected: formatMoney(row.collectedCents, "USD"),
		costs: formatMoney(row.costsCents, "USD"),
		profit: formatMoney(row.profitCents, "USD"),
		collectedProfit: formatMoney(row.collectedProfitCents, "USD"),
		margin: row.marginPct === null ? "" : formatPercent(row.marginPct / 100),
	}));

	const clientCsvColumns = [
		{ key: "client", label: "Client" },
		{ key: "deals", label: "Deals" },
		{ key: "invoiced", label: "Invoiced" },
		{ key: "collected", label: "Collected" },
		{ key: "costs", label: "Costs" },
		{ key: "profit", label: "Profit" },
		{ key: "collectedProfit", label: "Collected profit" },
		{ key: "margin", label: "Margin" },
	];
	const clientCsvRows = clientRows.map((row) => ({
		client: row.primaryContactName || "",
		deals: String(row.dealCount),
		invoiced: formatMoney(row.invoicedCents, "USD"),
		collected: formatMoney(row.collectedCents, "USD"),
		costs: formatMoney(row.costsCents, "USD"),
		profit: formatMoney(row.profitCents, "USD"),
		collectedProfit: formatMoney(row.collectedProfitCents, "USD"),
		margin: row.marginPct === null ? "" : formatPercent(row.marginPct / 100),
	}));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-3">
					<RangeControl />
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						spacing={0}
						value={view}
						onValueChange={(next) => {
							if (next === "deals" || next === "clients") {
								setView(next);
							}
						}}
						aria-label="Group by"
					>
						<ToggleGroupItem value="deals">Deals</ToggleGroupItem>
						<ToggleGroupItem value="clients">By client</ToggleGroupItem>
					</ToggleGroup>
				</div>
				{view === "deals" ? (
					<ExportCsvButton
						columns={dealCsvColumns}
						rows={dealCsvRows}
						filename="job-profitability.csv"
					/>
				) : (
					<ExportCsvButton
						columns={clientCsvColumns}
						rows={clientCsvRows}
						filename="job-profitability-by-client.csv"
					/>
				)}
			</div>

			{hasData ? (
				<>
					<KpiRow kpis={data?.kpis ?? []} />
					<div className="rounded-lg border">
						<BarTrend
							data={(data?.series ?? []).map((point) => ({
								x: point.x,
								value: Number(point.value ?? 0),
							}))}
							config={CHART_CONFIG}
							xKey="x"
							height={260}
							formatValue={(value) => formatMoney(Number(value), "USD")}
						/>
					</div>
				</>
			) : null}

			{view === "deals" ? (
				<DrillTable<Row> columns={dealColumns} rows={rows} />
			) : (
				<DrillTable<ClientRow> columns={clientColumns} rows={clientRows} />
			)}
		</div>
	);
}
