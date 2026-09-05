"use client";

import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import CurrencyDollar from "@carbon/icons-react/es/CurrencyDollar";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	SimpleTable,
	type SimpleTableColumn,
} from "@crm/ui/components/simple-table";
import { StatCard } from "@crm/ui/components/stat-card";
import { Textarea } from "@crm/ui/components/textarea";
import { formatMoney, fromDay, toDay } from "@crm/ui/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { AddInvoiceLineItem } from "./add-invoice-line-item";
import { AssignInvoiceContact } from "./assign-invoice-contact";
import { InvoiceLineRow } from "./invoice-line-row";

export type InvoiceDetailData = RouterOutputs["invoices"]["byId"];
export type InvoiceLineItemRow = InvoiceDetailData["lineItems"][number];
export type InvoiceStatusValue = InvoiceDetailData["status"];

const STATUS_ORDER: InvoiceStatusValue[] = ["DRAFT", "SENT", "PAID", "VOID"];

const STATUS_LABEL: Record<InvoiceStatusValue, string> = {
	DRAFT: "Draft",
	SENT: "Sent",
	PAID: "Paid",
	VOID: "Void",
};

const STATUS_VARIANT: Record<
	InvoiceStatusValue,
	"secondary" | "outline" | "destructive"
> = {
	DRAFT: "secondary",
	SENT: "outline",
	PAID: "outline",
	VOID: "destructive",
};

const GENERAL_GROUP = "General";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Item" },
	{ id: "quantity", header: "Qty", width: "w-28", align: "right" },
	{ id: "unit", header: "Unit", width: "w-32" },
	{ id: "price", header: "Price", width: "w-36", align: "right" },
	{ id: "total", header: "Total", width: "w-32", align: "right" },
	{ id: "actions", srLabel: "Remove", width: "w-10" },
];

function toIsoString(value: Date | string | null): string | null {
	if (value === null) return null;
	return value instanceof Date ? value.toISOString() : value;
}

function groupLineItems(
	lineItems: InvoiceLineItemRow[],
): [string, InvoiceLineItemRow[]][] {
	const groups = new Map<string, InvoiceLineItemRow[]>();
	const general: InvoiceLineItemRow[] = [];

	for (const item of lineItems) {
		if (!item.areaLabel) {
			general.push(item);
			continue;
		}
		const list = groups.get(item.areaLabel) ?? [];
		list.push(item);
		groups.set(item.areaLabel, list);
	}

	const entries = Array.from(groups.entries());
	if (general.length > 0 || entries.length === 0) {
		entries.push([GENERAL_GROUP, general]);
	}
	return entries;
}

export function InvoiceDetail({
	invoiceId,
	initialInvoice,
}: {
	invoiceId: string;
	initialInvoice: InvoiceDetailData;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();

	const invoice = useQuery({
		...trpc.invoices.byId.queryOptions({ id: invoiceId }),
		initialData: initialInvoice,
	});

	const data = invoice.data;

	const [notes, setNotes] = useState(data.notes ?? "");
	useEffect(() => setNotes(data.notes ?? ""), [data.notes]);

	const setQueryData = (
		updater: (previous: InvoiceDetailData) => InvoiceDetailData,
	) => {
		queryClient.setQueryData(
			trpc.invoices.byId.queryKey({ id: invoiceId }),
			(previous: InvoiceDetailData | undefined) =>
				previous ? updater(previous) : previous,
		);
	};

	const setStatus = useMutation(
		trpc.invoices.setStatus.mutationOptions({
			onMutate: (input) => {
				setQueryData((previous) => ({ ...previous, status: input.status }));
			},
			onSuccess: () => void cache.invoice(invoiceId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const markPaid = useMutation(
		trpc.invoices.markPaid.mutationOptions({
			onSuccess: () => void cache.invoice(invoiceId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const update = useMutation(
		trpc.invoices.update.mutationOptions({
			onSuccess: () => void cache.invoice(invoiceId, { settle: "record" }),
			onError: (error) => toast.error(error.message),
		}),
	);

	const commitNotes = () => {
		const next = notes.trim();
		if (next === (data.notes ?? "")) return;
		update.mutate({ id: invoiceId, data: { notes: next || null } });
	};

	const saveIssuedAt = (next: string) => {
		update.mutate({
			id: invoiceId,
			data: { issuedAt: next ? (fromDay(next) ?? null) : null },
		});
	};

	const saveDueAt = (next: string) => {
		update.mutate({
			id: invoiceId,
			data: { dueAt: next ? (fromDay(next) ?? null) : null },
		});
	};

	const groups = useMemo(
		() => groupLineItems(data.lineItems),
		[data.lineItems],
	);

	const issuedDay = toIsoString(data.issuedAt);
	const dueDay = toIsoString(data.dueAt);

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Invoice #{data.number}</PageShellTitle>
				</PageShellHeading>
				<PageShellActions>
					<Select
						value={data.status}
						onValueChange={(status) =>
							setStatus.mutate({
								id: invoiceId,
								status: status as InvoiceStatusValue,
							})
						}
					>
						<SelectTrigger variant="ghost">
							<SelectValue>
								<Badge variant={STATUS_VARIANT[data.status]}>
									{STATUS_LABEL[data.status]}
								</Badge>
							</SelectValue>
						</SelectTrigger>
						<SelectContent align="end">
							{STATUS_ORDER.map((status) => (
								<SelectItem key={status} value={status}>
									{STATUS_LABEL[status]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<AssignInvoiceContact
						invoiceId={invoiceId}
						contactId={data.contactId}
					/>
					{data.status === "DRAFT" || data.status === "SENT" ? (
						<Button
							variant={data.status === "SENT" ? "default" : "outline"}
							size="sm"
							disabled={markPaid.isPending}
							onClick={() => markPaid.mutate({ id: invoiceId })}
						>
							Mark paid
						</Button>
					) : null}
					<Button variant="outline" size="sm" asChild>
						<Link href={workspaceUrl("/invoices")}>
							<Icon icon={ArrowLeft} data-icon="inline-start" />
							Back
						</Link>
					</Button>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<div className="flex flex-col gap-6">
					<div className="grid gap-3 sm:grid-cols-3">
						<Field>
							<FieldLabel>Issued</FieldLabel>
							<DatePicker
								value={issuedDay ? toDay(new Date(issuedDay)) : null}
								onChange={saveIssuedAt}
							/>
						</Field>
						<Field>
							<FieldLabel>Due</FieldLabel>
							<DatePicker
								value={dueDay ? toDay(new Date(dueDay)) : null}
								onChange={saveDueAt}
							/>
						</Field>
						<StatCard
							label="Total"
							value={formatMoney(data.totalCents, data.currency)}
							className="rounded-lg border bg-card"
						/>
					</div>

					<Field>
						<FieldLabel>Notes</FieldLabel>
						<Textarea
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							onBlur={commitNotes}
							rows={3}
						/>
					</Field>

					{data.lineItems.length === 0 ? (
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Icon icon={CurrencyDollar} />
								</EmptyMedia>
								<EmptyTitle>No line items yet</EmptyTitle>
								<EmptyDescription>
									Add a service from the price book, or a custom line.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<div className="flex flex-col gap-6">
							{groups.map(([areaLabel, items]) => (
								<div key={areaLabel} className="flex flex-col gap-2">
									<h2 className="font-medium text-sm text-muted-foreground">
										{areaLabel}
									</h2>
									<SimpleTable columns={COLUMNS}>
										{items.map((item) => (
											<InvoiceLineRow
												key={item.id}
												invoiceId={invoiceId}
												item={item}
												currency={data.currency}
											/>
										))}
									</SimpleTable>
								</div>
							))}
						</div>
					)}

					<div>
						<AddInvoiceLineItem
							invoiceId={invoiceId}
							currency={data.currency}
						/>
					</div>

					<div className="flex justify-end border-t pt-4">
						<span className="text-lg font-semibold tabular-nums">
							Total: {formatMoney(data.totalCents, data.currency)}
						</span>
					</div>
				</div>
			</PageShellContent>
		</PageShell>
	);
}
