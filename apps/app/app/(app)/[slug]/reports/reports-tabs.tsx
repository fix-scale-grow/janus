"use client";

import Partnership from "@carbon/icons-react/es/Partnership";
import Receipt from "@carbon/icons-react/es/Receipt";
import ReportIcon from "@carbon/icons-react/es/Report";
import type { ChartConfig } from "@crm/ui/components/chart";
import { DatePicker } from "@crm/ui/components/date-picker";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import { formatMoney, formatPercent } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { BarTrend } from "@/components/dashboard-charts";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type ClientRow = RouterOutputs["reports"]["byClient"]["rows"][number];
type MonthRow = RouterOutputs["reports"]["byMonth"]["rows"][number];
type CategoryRow = RouterOutputs["reports"]["byCategory"]["rows"][number];
type Category = CategoryRow["category"];

const CATEGORY_LABEL: Record<Category, string> = {
	MATERIALS: "Materials",
	LABOR: "Labor",
	SUBCONTRACTOR: "Subcontractor",
	EQUIPMENT: "Equipment",
	PERMITS_FEES: "Permits & fees",
	OTHER: "Other",
};

const MONTH_CHART_CONFIG: ChartConfig = {
	invoiced: { label: "Invoiced", color: "var(--chart-1)" },
	costs: { label: "Costs", color: "var(--chart-2)" },
	profit: { label: "Profit", color: "var(--chart-3)" },
};

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-US", {
	month: "short",
	year: "2-digit",
});

function formatMonthLabel(month: string): string {
	const [year, monthIndex] = month.split("-").map(Number);
	if (!year || !monthIndex) return month;
	return MONTH_LABEL_FORMAT.format(new Date(year, monthIndex - 1, 1));
}

function mostActiveCurrency(rows: MonthRow[]): string | undefined {
	const totals = new Map<string, number>();
	for (const row of rows) {
		totals.set(
			row.currency,
			(totals.get(row.currency) ?? 0) + row.invoicedCents + row.costsCents,
		);
	}
	let best: string | undefined;
	let bestTotal = -1;
	for (const [currency, total] of totals) {
		if (total > bestTotal) {
			best = currency;
			bestTotal = total;
		}
	}
	return best;
}

export function ReportsTabs() {
	return (
		<Tabs defaultValue="client">
			<TabsList>
				<TabsTrigger value="client">By client</TabsTrigger>
				<TabsTrigger value="month">By month</TabsTrigger>
				<TabsTrigger value="category">By category</TabsTrigger>
			</TabsList>

			<TabsContent value="client">
				<ByClientReport />
			</TabsContent>
			<TabsContent value="month">
				<ByMonthReport />
			</TabsContent>
			<TabsContent value="category">
				<ByCategoryReport />
			</TabsContent>
		</Tabs>
	);
}

function ByClientReport() {
	const trpc = useTRPC();
	const { data } = useQuery(trpc.reports.byClient.queryOptions());
	const rows = data?.rows ?? [];
	const showCurrency = new Set(rows.map((row) => row.currency)).size > 1;

	if (rows.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={Partnership} />
					</EmptyMedia>
					<EmptyTitle>No profit data yet</EmptyTitle>
					<EmptyDescription>
						Invoice a deal and log a cost against it to see client profit here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<SimpleTable
			columns={[
				{ id: "client", header: "Client", width: "w-[26%]", className: "pl-5" },
				...(showCurrency
					? [{ id: "currency", header: "Currency", width: "w-[10%]" }]
					: []),
				{
					id: "jobs",
					header: "Jobs",
					align: "right" as const,
					width: "w-[10%]",
				},
				{
					id: "invoiced",
					header: "Invoiced",
					align: "right" as const,
					width: "w-[16%]",
				},
				{
					id: "costs",
					header: "Costs",
					align: "right" as const,
					width: "w-[16%]",
				},
				{
					id: "profit",
					header: "Profit",
					align: "right" as const,
					width: "w-[16%]",
				},
				{
					id: "margin",
					header: "Margin",
					align: "right" as const,
					width: "w-[10%]",
					className: "pr-5",
				},
			]}
		>
			{rows.map((row) => (
				<ClientReportRow
					key={`${row.contactId}-${row.currency}`}
					row={row}
					showCurrency={showCurrency}
				/>
			))}
		</SimpleTable>
	);
}

function ClientReportRow({
	row,
	showCurrency,
}: {
	row: ClientRow;
	showCurrency: boolean;
}) {
	return (
		<SimpleTableRow>
			<TableCell className="truncate py-2.5 pr-3 pl-5">
				<RecordLink
					kind="contact"
					id={row.contactId}
					className="text-foreground"
				>
					{row.name || "Unnamed contact"}
				</RecordLink>
			</TableCell>
			{showCurrency ? (
				<TableCell className="px-3 py-2.5 text-muted-foreground uppercase">
					{row.currency}
				</TableCell>
			) : null}
			<TableCell className="px-3 py-2.5 text-right tabular-nums">
				{row.dealCount}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-right tabular-nums">
				{formatMoney(row.invoicedCents, row.currency)}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-right tabular-nums">
				{formatMoney(row.costsCents, row.currency)}
			</TableCell>
			<TableCell
				className={cn(
					"px-3 py-2.5 text-right tabular-nums",
					row.profitCents < 0 && "text-destructive",
				)}
			>
				{formatMoney(row.profitCents, row.currency)}
			</TableCell>
			<TableCell className="px-3 py-2.5 pr-5 text-right tabular-nums">
				{row.marginPct === null ? "—" : formatPercent(row.marginPct / 100)}
			</TableCell>
		</SimpleTableRow>
	);
}

function ByMonthReport() {
	const trpc = useTRPC();
	const { data } = useQuery(trpc.reports.byMonth.queryOptions());
	const rows = data?.rows ?? [];
	const currencies = useMemo(
		() => [...new Set(rows.map((row) => row.currency))],
		[rows],
	);
	const primary = useMemo(() => mostActiveCurrency(rows), [rows]);

	const hasActivity = rows.some(
		(row) => row.invoicedCents !== 0 || row.costsCents !== 0,
	);

	if (rows.length === 0 || !hasActivity) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={ReportIcon} />
					</EmptyMedia>
					<EmptyTitle>No activity in the last 12 months</EmptyTitle>
					<EmptyDescription>
						Invoices and costs will show up here once they exist.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const chartRows = rows.filter((row) => row.currency === primary);

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-lg border">
				<BarTrend
					data={chartRows.map((row) => ({
						month: row.month,
						invoiced: row.invoicedCents,
						costs: row.costsCents,
						profit: row.profitCents,
					}))}
					config={MONTH_CHART_CONFIG}
					xKey="month"
					height={260}
					showLegend
					formatX={formatMonthLabel}
					formatValue={(value: number | string) =>
						formatMoney(Number(value), primary)
					}
				/>
			</div>

			<SimpleTable
				columns={[
					{ id: "month", header: "Month", width: "w-[20%]", className: "pl-5" },
					{ id: "currency", header: "Currency", width: "w-[15%]" },
					{
						id: "invoiced",
						header: "Invoiced",
						align: "right" as const,
						width: "w-[21%]",
					},
					{
						id: "costs",
						header: "Costs",
						align: "right" as const,
						width: "w-[21%]",
					},
					{
						id: "profit",
						header: "Profit",
						align: "right" as const,
						width: "w-[21%]",
						className: "pr-5",
					},
				]}
			>
				{currencies.flatMap((currency) =>
					rows
						.filter((row) => row.currency === currency)
						.map((row) => (
							<MonthReportRow key={`${currency}-${row.month}`} row={row} />
						)),
				)}
			</SimpleTable>
		</div>
	);
}

function MonthReportRow({ row }: { row: MonthRow }) {
	return (
		<SimpleTableRow>
			<TableCell className="truncate py-2.5 pr-3 pl-5 text-muted-foreground">
				{formatMonthLabel(row.month)}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-muted-foreground uppercase">
				{row.currency}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-right tabular-nums">
				{formatMoney(row.invoicedCents, row.currency)}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-right tabular-nums">
				{formatMoney(row.costsCents, row.currency)}
			</TableCell>
			<TableCell
				className={cn(
					"px-3 py-2.5 pr-5 text-right tabular-nums",
					row.profitCents < 0 && "text-destructive",
				)}
			>
				{formatMoney(row.profitCents, row.currency)}
			</TableCell>
		</SimpleTableRow>
	);
}

function ByCategoryReport() {
	const trpc = useTRPC();
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");

	const { data } = useQuery(
		trpc.reports.byCategory.queryOptions({
			from: from || undefined,
			to: to || undefined,
		}),
	);
	const rows = data?.rows ?? [];
	const showCurrency = new Set(rows.map((row) => row.currency)).size > 1;

	const totalsByCurrency = useMemo(() => {
		const totals = new Map<string, number>();
		for (const row of rows) {
			totals.set(
				row.currency,
				(totals.get(row.currency) ?? 0) + row.totalCents,
			);
		}
		return totals;
	}, [rows]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="w-40">
					<DatePicker value={from} onChange={setFrom} placeholder="From" />
				</div>
				<div className="w-40">
					<DatePicker value={to} onChange={setTo} placeholder="To" />
				</div>
			</div>

			{rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={Receipt} />
						</EmptyMedia>
						<EmptyTitle>No costs in this range</EmptyTitle>
						<EmptyDescription>
							Log a job cost to see spend broken down by category.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable
					columns={[
						{
							id: "category",
							header: "Category",
							width: "w-[30%]",
							className: "pl-5",
						},
						...(showCurrency
							? [{ id: "currency", header: "Currency", width: "w-[15%]" }]
							: []),
						{
							id: "total",
							header: "Total",
							align: "right" as const,
							width: "w-[25%]",
						},
						{
							id: "share",
							header: "% of total",
							align: "right" as const,
							width: "w-[20%]",
							className: "pr-5",
						},
					]}
				>
					{rows.map((row) => {
						const total = totalsByCurrency.get(row.currency) ?? 0;
						const share = total > 0 ? row.totalCents / total : null;
						return (
							<SimpleTableRow key={`${row.category}-${row.currency}`}>
								<TableCell className="truncate py-2.5 pr-3 pl-5">
									{CATEGORY_LABEL[row.category]}
								</TableCell>
								{showCurrency ? (
									<TableCell className="px-3 py-2.5 text-muted-foreground uppercase">
										{row.currency}
									</TableCell>
								) : null}
								<TableCell className="px-3 py-2.5 text-right tabular-nums">
									{formatMoney(row.totalCents, row.currency)}
								</TableCell>
								<TableCell className="px-3 py-2.5 pr-5 text-right tabular-nums">
									{share === null ? "—" : formatPercent(share)}
								</TableCell>
							</SimpleTableRow>
						);
					})}
				</SimpleTable>
			)}
		</div>
	);
}
