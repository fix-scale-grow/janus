"use client";

import Add from "@carbon/icons-react/es/Add";
import Money from "@carbon/icons-react/es/Money";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
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
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type ServiceRow = RouterOutputs["services"]["list"]["rows"][number];

type ServiceUnit = ServiceRow["unit"];

const UNIT_LABELS: Record<ServiceUnit, string> = {
	PER_SQUARE: "per square",
	PER_LINEAR_FT: "per linear ft",
	PER_EACH: "per each",
	FLAT: "flat",
};

const UNIT_OPTIONS = Object.entries(UNIT_LABELS) as [ServiceUnit, string][];

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Name" },
	{ id: "unit", header: "Unit", width: "w-32" },
	{ id: "price", header: "Price", width: "w-24", align: "right" },
	{ id: "good", header: "Good", width: "w-24", align: "right" },
	{ id: "best", header: "Best", width: "w-24", align: "right" },
	{ id: "symbol", header: "Symbol", width: "w-40" },
	{ id: "active", header: "Active", width: "w-16", align: "center" },
];

const CELL = "px-3 py-2.5 align-middle";

function centsToDollars(cents: number | null | undefined): string {
	if (cents == null) return "";
	return (cents / 100).toFixed(2);
}

function formatDollars(cents: number | null | undefined): string {
	if (cents == null) return "—";
	return `$${centsToDollars(cents)}`;
}

function parseRequiredCents(value: string): number | undefined {
	const trimmed = value.trim();
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return Math.round(parsed * 100);
}

function parseOptionalCents(value: string): number | null | undefined {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return Math.round(parsed * 100);
}

type ServiceFormValues = {
	name: string;
	trade: string;
	unit: ServiceUnit;
	unitPrice: string;
	priceGood: string;
	priceBest: string;
	symbolId: string;
	active: boolean;
};

function emptyForm(): ServiceFormValues {
	return {
		name: "",
		trade: "roofing",
		unit: "PER_SQUARE",
		unitPrice: "",
		priceGood: "",
		priceBest: "",
		symbolId: "",
		active: true,
	};
}

function formFromRow(row: ServiceRow): ServiceFormValues {
	return {
		name: row.name,
		trade: row.trade,
		unit: row.unit,
		unitPrice: centsToDollars(row.unitPriceCents),
		priceGood: centsToDollars(row.priceGoodCents),
		priceBest: centsToDollars(row.priceBestCents),
		symbolId: row.symbolId ?? "",
		active: row.active,
	};
}

export function PriceBookTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<ServiceRow | null>(null);

	const services = useQuery(
		trpc.services.list.queryOptions({
			q: "",
			sort: "name",
			dir: "asc",
			page: 1,
			pageSize: 100,
		}),
	);

	const seed = useMutation(
		trpc.services.seedRoofing.mutationOptions({
			onSuccess: async (result) => {
				await cache.service();
				toast.success(`Loaded ${result.created} services.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const toggleActive = useMutation(
		trpc.services.update.mutationOptions({
			onSuccess: (row) => cache.service(row.id),
			onError: (error) => toast.error(error.message),
		}),
	);

	const rows = services.data?.rows ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Services</CardTitle>
				<CardDescription>
					The catalog an estimate's line items are picked from.
				</CardDescription>
				<CardAction>
					<Button size="sm" onClick={() => setCreating(true)}>
						<Icon icon={Add} data-icon="inline-start" />
						New service
					</Button>
				</CardAction>
			</CardHeader>

			{services.isPending ? (
				<CardTableEmpty>
					<Spinner data-icon="inline-start" />
					Loading services…
				</CardTableEmpty>
			) : rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={Money} />
						</EmptyMedia>
						<EmptyTitle>No services yet</EmptyTitle>
						<EmptyDescription>
							Start from the roofing starter book, or add your own.
						</EmptyDescription>
					</EmptyHeader>
					<Button
						variant="outline"
						disabled={seed.isPending}
						onClick={() => seed.mutate()}
					>
						{seed.isPending ? <Spinner data-icon="inline-start" /> : null}
						Load roofing starter book
					</Button>
				</Empty>
			) : (
				<SimpleTable columns={COLUMNS}>
					{rows.map((row) => (
						<SimpleTableRow
							key={row.id}
							clickable
							onClick={() => setEditing(row)}
						>
							<TableCell className={`${CELL} font-medium`}>
								{row.name}
							</TableCell>
							<TableCell className={`${CELL} text-muted-foreground`}>
								{UNIT_LABELS[row.unit]}
							</TableCell>
							<TableCell className={`${CELL} text-right tabular-nums`}>
								{formatDollars(row.unitPriceCents)}
							</TableCell>
							<TableCell className={`${CELL} text-right tabular-nums`}>
								{formatDollars(row.priceGoodCents)}
							</TableCell>
							<TableCell className={`${CELL} text-right tabular-nums`}>
								{formatDollars(row.priceBestCents)}
							</TableCell>
							<TableCell className={`${CELL} truncate text-muted-foreground`}>
								{row.symbolId ?? "—"}
							</TableCell>
							<TableCell className={`${CELL} text-center`}>
								<Switch
									checked={row.active}
									disabled={toggleActive.isPending}
									onClick={(event) => event.stopPropagation()}
									onCheckedChange={(active) =>
										toggleActive.mutate({ id: row.id, data: { active } })
									}
								/>
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			<ServiceDialog mode="create" open={creating} onOpenChange={setCreating} />
			<ServiceDialog
				mode="edit"
				row={editing}
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
			/>
		</Card>
	);
}

function ServiceDialog({
	mode,
	row,
	open,
	onOpenChange,
}: {
	mode: "create" | "edit";
	row?: ServiceRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [values, setValues] = useState<ServiceFormValues>(
		row ? formFromRow(row) : emptyForm(),
	);

	useEffect(() => {
		if (open) {
			setValues(row ? formFromRow(row) : emptyForm());
		}
	}, [open, row]);

	const nameId = useId();
	const tradeId = useId();
	const unitId = useId();
	const priceId = useId();
	const goodId = useId();
	const bestId = useId();
	const symbolId = useId();
	const activeId = useId();

	const create = useMutation(
		trpc.services.create.mutationOptions({
			onSuccess: async () => {
				await cache.service();
				toast.success("Service added.");
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const update = useMutation(
		trpc.services.update.mutationOptions({
			onSuccess: async (result) => {
				await cache.service(result.id);
				toast.success("Service saved.");
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.services.delete.mutationOptions({
			onSuccess: async () => {
				await cache.service();
				toast.success("Service removed.");
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const busy = create.isPending || update.isPending || remove.isPending;

	const submit = () => {
		if (!values.name.trim()) {
			toast.error("A service needs a name.");
			return;
		}

		const unitPriceCents = parseRequiredCents(values.unitPrice);
		if (unitPriceCents === undefined) {
			toast.error("Price has to be a number, zero or more.");
			return;
		}

		const priceGoodCents = parseOptionalCents(values.priceGood);
		if (priceGoodCents === undefined) {
			toast.error("Good price has to be a number, zero or more.");
			return;
		}

		const priceBestCents = parseOptionalCents(values.priceBest);
		if (priceBestCents === undefined) {
			toast.error("Best price has to be a number, zero or more.");
			return;
		}

		const data = {
			name: values.name.trim(),
			trade: values.trade.trim() || "roofing",
			unit: values.unit,
			unitPriceCents,
			priceGoodCents,
			priceBestCents,
			symbolId: values.symbolId.trim() || null,
			active: values.active,
		};

		if (mode === "create") {
			create.mutate(data);
			return;
		}

		if (row) {
			update.mutate({ id: row.id, data });
		}
	};

	const formId = `service-form-${mode}-${row?.id ?? "new"}`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "New service" : "Edit service"}
					</DialogTitle>
				</DialogHeader>

				<form
					id={formId}
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<Field>
						<FieldLabel htmlFor={nameId}>Name</FieldLabel>
						<Input
							id={nameId}
							value={values.name}
							autoFocus
							onChange={(event) =>
								setValues((prev) => ({ ...prev, name: event.target.value }))
							}
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor={tradeId}>Trade</FieldLabel>
						<Input
							id={tradeId}
							value={values.trade}
							onChange={(event) =>
								setValues((prev) => ({ ...prev, trade: event.target.value }))
							}
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor={unitId}>Unit</FieldLabel>
						<Select
							value={values.unit}
							onValueChange={(unit) =>
								setValues((prev) => ({ ...prev, unit: unit as ServiceUnit }))
							}
						>
							<SelectTrigger id={unitId} className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{UNIT_OPTIONS.map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					<div className="grid grid-cols-3 gap-3">
						<Field>
							<FieldLabel htmlFor={priceId}>Price</FieldLabel>
							<Input
								id={priceId}
								inputMode="decimal"
								placeholder="0.00"
								value={values.unitPrice}
								onChange={(event) =>
									setValues((prev) => ({
										...prev,
										unitPrice: event.target.value,
									}))
								}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={goodId}>Good</FieldLabel>
							<Input
								id={goodId}
								inputMode="decimal"
								placeholder="0.00"
								value={values.priceGood}
								onChange={(event) =>
									setValues((prev) => ({
										...prev,
										priceGood: event.target.value,
									}))
								}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={bestId}>Best</FieldLabel>
							<Input
								id={bestId}
								inputMode="decimal"
								placeholder="0.00"
								value={values.priceBest}
								onChange={(event) =>
									setValues((prev) => ({
										...prev,
										priceBest: event.target.value,
									}))
								}
							/>
						</Field>
					</div>

					<Field>
						<FieldLabel htmlFor={symbolId}>Symbol</FieldLabel>
						<Input
							id={symbolId}
							value={values.symbolId}
							placeholder="Optional drawing symbol id"
							onChange={(event) =>
								setValues((prev) => ({
									...prev,
									symbolId: event.target.value,
								}))
							}
						/>
					</Field>

					<Field orientation="horizontal">
						<FieldLabel htmlFor={activeId}>Active</FieldLabel>
						<Switch
							id={activeId}
							checked={values.active}
							onCheckedChange={(active) =>
								setValues((prev) => ({ ...prev, active }))
							}
						/>
					</Field>
				</form>

				<DialogFooter>
					{mode === "edit" && row ? (
						<Button
							type="button"
							variant="destructive"
							disabled={busy}
							onClick={() => remove.mutate({ id: row.id })}
							className="sm:mr-auto"
						>
							Delete
						</Button>
					) : null}
					<Button type="submit" form={formId} disabled={busy}>
						{busy ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
