"use client";

import Add from "@carbon/icons-react/es/Add";
import Attachment from "@carbon/icons-react/es/Attachment";
import Edit from "@carbon/icons-react/es/Edit";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import { formatMoney, formatPercent, toDay } from "@crm/ui/lib/format";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetEmpty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Cost = RouterOutputs["costs"]["list"]["rows"][number];
type Category = Cost["category"];
type ProfitLine = RouterOutputs["costs"]["profitForDeal"]["byCurrency"][number];

const PROFIT_VIEW_KEY = "profit.view";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
	{ value: "MATERIALS", label: "Materials" },
	{ value: "LABOR", label: "Labor" },
	{ value: "SUBCONTRACTOR", label: "Subcontractor" },
	{ value: "EQUIPMENT", label: "Equipment" },
	{ value: "PERMITS_FEES", label: "Permits & fees" },
	{ value: "OTHER", label: "Other" },
];

const CATEGORY_LABEL: Record<Category, string> = Object.fromEntries(
	CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Category, string>;

const RECEIPT_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

const COST_COLUMNS = [
	{ id: "date", header: "Date", width: "w-[14%]", className: "pl-5" },
	{ id: "category", header: "Category", width: "w-[16%]" },
	{ id: "note", header: "Note", width: "w-[26%]" },
	{ id: "loggedBy", header: "Logged by", width: "w-[16%]" },
	{ id: "amount", header: "Amount", width: "w-[14%]", align: "right" as const },
	{
		id: "receipt",
		header: <span className="sr-only">Receipt</span>,
		width: "w-10",
	},
	{
		id: "actions",
		header: <span className="sr-only">Actions</span>,
		width: "w-16",
	},
];

async function uploadReceipt(costId: string, file: File): Promise<boolean> {
	try {
		const body = new FormData();
		body.set("costId", costId);
		body.set("file", file);
		const response = await fetch("/api/costs/receipt", {
			method: "POST",
			body,
		});
		return response.ok;
	} catch {
		return false;
	}
}

async function deleteReceipt(costId: string): Promise<void> {
	try {
		await fetch(`/api/costs/receipt/${costId}`, { method: "DELETE" });
	} catch {
		return undefined;
	}
}

export function DealCosts({ dealId }: { dealId: string }) {
	const trpc = useTRPC();

	const costs = useQuery(trpc.costs.list.queryOptions({ dealId }));
	const permissions = useQuery(trpc.permissions.mine.queryOptions());
	const canViewProfit =
		permissions.data?.keys.includes(PROFIT_VIEW_KEY) ?? false;

	const profit = useQuery({
		...trpc.costs.profitForDeal.queryOptions({ dealId }),
		enabled: canViewProfit,
	});

	const rows = costs.data?.rows ?? [];

	return (
		<DetailSheetBody>
			<DetailSheetSection title="Profit">
				{canViewProfit ? (
					<ProfitStrip lines={profit.data?.byCurrency ?? []} />
				) : (
					<p className="text-muted-foreground text-xs">
						Costs ·{" "}
						{(costs.data?.totalsByCurrency ?? [])
							.map((entry) => formatMoney(entry.totalCents, entry.currency))
							.join(", ") || formatMoney(0)}
					</p>
				)}
			</DetailSheetSection>

			<DetailSheetSection title="Costs">
				<QuickAddCost dealId={dealId} />

				{rows.length === 0 ? (
					<DetailSheetEmpty
						icon={Attachment}
						title="No costs logged"
						description="Log materials, labor and other job costs as they come in."
					/>
				) : (
					<SimpleTable variant="panel" columns={COST_COLUMNS}>
						{rows.map((row) => (
							<CostRow key={row.id} row={row} dealId={dealId} />
						))}
					</SimpleTable>
				)}
			</DetailSheetSection>
		</DetailSheetBody>
	);
}

function ProfitStrip({ lines }: { lines: ProfitLine[] }) {
	if (lines.length === 0) {
		return <p className="text-muted-foreground text-xs">No revenue yet.</p>;
	}

	return (
		<div className="flex flex-col gap-1.5">
			{lines.map((line) => (
				<div
					key={line.currency}
					className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
				>
					<span className="font-medium text-muted-foreground uppercase tracking-wide">
						{line.currency}
					</span>
					<span>
						Invoiced{" "}
						<span className="tabular-nums">
							{formatMoney(line.invoicedCents, line.currency)}
						</span>
					</span>
					<span>
						Collected{" "}
						<span className="tabular-nums">
							{formatMoney(line.collectedCents, line.currency)}
						</span>
					</span>
					<span>
						Costs{" "}
						<span className="tabular-nums">
							{formatMoney(line.costsCents, line.currency)}
						</span>
					</span>
					<span
						className={cn(
							"font-medium",
							line.profitCents < 0 && "text-destructive",
						)}
					>
						Profit{" "}
						<span className="tabular-nums">
							{formatMoney(line.profitCents, line.currency)}
						</span>
						{line.marginPct === null ? null : (
							<span className="tabular-nums">
								{" "}
								({formatPercent(line.marginPct / 100)})
							</span>
						)}
					</span>
				</div>
			))}
		</div>
	);
}

function QuickAddCost({ dealId }: { dealId: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const fileInput = useRef<HTMLInputElement>(null);

	const [date, setDate] = useState<string>(toDay(new Date()));
	const [category, setCategory] = useState<Category>("MATERIALS");
	const [amount, setAmount] = useState("");
	const [note, setNote] = useState("");
	const [pendingFile, setPendingFile] = useState<File | null>(null);

	const create = useMutation(
		trpc.costs.create.mutationOptions({
			onSuccess: async (created) => {
				if (pendingFile) {
					const ok = await uploadReceipt(created.id, pendingFile);
					if (!ok)
						toast.error(
							"The cost was logged, but the receipt failed to attach.",
						);
				}
				setAmount("");
				setNote("");
				setPendingFile(null);
				if (fileInput.current) fileInput.current.value = "";
				void cache.costs(dealId);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		const parsed = Number(amount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			toast.error("Amount has to be a number greater than zero.");
			return;
		}

		create.mutate({
			dealId,
			date,
			amountCents: Math.round(parsed * 100),
			category,
			note: note.trim() || undefined,
		});
	};

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
			<div className="w-36">
				<DatePicker
					value={date}
					onChange={(next) => setDate(next || toDay(new Date()))}
				/>
			</div>

			<Select
				value={category}
				onValueChange={(value) => setCategory(value as Category)}
			>
				<SelectTrigger size="sm" className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{CATEGORY_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Input
				inputMode="decimal"
				placeholder="Amount"
				value={amount}
				onChange={(event) => setAmount(event.target.value)}
				className="w-28"
			/>

			<Input
				placeholder="Note"
				value={note}
				onChange={(event) => setNote(event.target.value)}
				className="flex-1"
			/>

			<input
				ref={fileInput}
				type="file"
				accept={RECEIPT_ACCEPT}
				className="hidden"
				onChange={(event) =>
					setPendingFile(event.currentTarget.files?.[0] ?? null)
				}
			/>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				onClick={() => fileInput.current?.click()}
				aria-label={
					pendingFile
						? `Receipt attached: ${pendingFile.name}`
						: "Attach receipt"
				}
			>
				<Icon
					icon={Attachment}
					className={pendingFile ? "text-primary" : undefined}
				/>
			</Button>

			<Button
				type="button"
				size="sm"
				disabled={create.isPending || !amount.trim()}
				onClick={submit}
			>
				<Icon icon={Add} data-icon="inline-start" />
				Log cost
			</Button>
		</div>
	);
}

function CostRow({ row, dealId }: { row: Cost; dealId: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const fileInput = useRef<HTMLInputElement>(null);
	const [editOpen, setEditOpen] = useState(false);

	const remove = useMutation(
		trpc.costs.remove.mutationOptions({
			onSuccess: () => {
				if (row.receiptPath) void deleteReceipt(row.id);
				void cache.costs(dealId);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const attach = async (file: File) => {
		const ok = await uploadReceipt(row.id, file);
		if (!ok) {
			toast.error("The receipt could not be attached.");
			return;
		}
		void cache.costs(dealId);
	};

	return (
		<SimpleTableRow>
			<TableCell className="truncate py-2.5 pr-3 pl-5 text-muted-foreground">
				<LocalDay date={row.date} />
			</TableCell>
			<TableCell className="truncate px-3 py-2.5">
				<Badge variant="outline">{CATEGORY_LABEL[row.category]}</Badge>
			</TableCell>
			<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
				{row.note ?? ""}
			</TableCell>
			<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
				{row.createdBy.name}
			</TableCell>
			<TableCell className="truncate px-3 py-2.5 text-right tabular-nums">
				{formatMoney(row.amountCents, row.currency)}
			</TableCell>
			<TableCell className="px-3 py-2.5">
				{row.receiptPath ? (
					<a
						href={`/api/costs/receipt/${row.id}`}
						target="_blank"
						rel="noreferrer noopener"
						aria-label="Open receipt"
					>
						<Icon icon={Attachment} className="text-primary" />
					</a>
				) : (
					<>
						<input
							ref={fileInput}
							type="file"
							accept={RECEIPT_ACCEPT}
							className="hidden"
							onChange={(event) => {
								const file = event.currentTarget.files?.[0];
								if (file) void attach(file);
								event.currentTarget.value = "";
							}}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							onClick={() => fileInput.current?.click()}
							aria-label="Attach receipt"
						>
							<Icon icon={Attachment} className="text-muted-foreground" />
						</Button>
					</>
				)}
			</TableCell>
			<TableCell className="px-3 py-2.5">
				<div className="flex items-center justify-end gap-1">
					<Popover open={editOpen} onOpenChange={setEditOpen}>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="icon-xs" aria-label="Edit cost">
								<Icon icon={Edit} />
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-72">
							<EditCostForm
								row={row}
								dealId={dealId}
								onDone={() => setEditOpen(false)}
							/>
						</PopoverContent>
					</Popover>

					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="ghost" size="icon-xs" aria-label="Delete cost">
								<Icon icon={TrashCan} />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete this cost?</AlertDialogTitle>
								<AlertDialogDescription>
									This cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									onClick={async () => {
										if (row.receiptPath) await deleteReceipt(row.id);
										remove.mutate({ id: row.id });
									}}
								>
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</TableCell>
		</SimpleTableRow>
	);
}

function EditCostForm({
	row,
	dealId,
	onDone,
}: {
	row: Cost;
	dealId: string;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [date, setDate] = useState<string>(toDay(new Date(row.date)));
	const [category, setCategory] = useState<Category>(row.category);
	const [amount, setAmount] = useState(String(row.amountCents / 100));
	const [note, setNote] = useState(row.note ?? "");

	const update = useMutation(
		trpc.costs.update.mutationOptions({
			onSuccess: () => {
				void cache.costs(dealId);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		const parsed = Number(amount);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			toast.error("Amount has to be a number greater than zero.");
			return;
		}

		update.mutate({
			id: row.id,
			date,
			amountCents: Math.round(parsed * 100),
			category,
			note: note.trim() || null,
		});
	};

	return (
		<div className="flex flex-col gap-2">
			<DatePicker value={date} onChange={(next) => setDate(next || date)} />

			<Select
				value={category}
				onValueChange={(value) => setCategory(value as Category)}
			>
				<SelectTrigger size="sm" className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{CATEGORY_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Input
				inputMode="decimal"
				placeholder="Amount"
				value={amount}
				onChange={(event) => setAmount(event.target.value)}
			/>

			<Input
				placeholder="Note"
				value={note}
				onChange={(event) => setNote(event.target.value)}
			/>

			<Button
				type="button"
				size="sm"
				disabled={update.isPending || !amount.trim()}
				onClick={submit}
			>
				Save
			</Button>
		</div>
	);
}
