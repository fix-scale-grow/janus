"use client";

import Add from "@carbon/icons-react/es/Add";
import PaintBrush from "@carbon/icons-react/es/PaintBrush";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
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
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { parseSymbolRowsWith, symbolRowBase } from "@/lib/symbol-rows";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type SymbolRow = z.infer<typeof symbolRowBase>;

function parseSymbolRows(value: unknown): {
	rows: SymbolRow[];
	failed: number;
} {
	return parseSymbolRowsWith(symbolRowBase, value);
}

function reportError(error: { message: string }) {
	toast.error(error.message);
}

const NONE = "none";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "name", header: "Name" },
	{ id: "trade", header: "Trade", width: "w-32" },
	{ id: "size", header: "Size", width: "w-32" },
	{ id: "service", header: "Service", width: "w-40" },
	{ id: "active", header: "Active", width: "w-16", align: "center" },
];

const CELL = "px-3 py-2.5 align-middle";

function sizeLabel(row: SymbolRow): string {
	if (row.widthFt && row.heightFt) {
		return `${row.widthFt} × ${row.heightFt} ft`;
	}
	if (row.widthFt) return `${row.widthFt} ft wide`;
	if (row.heightFt) return `${row.heightFt} ft tall`;
	return "—";
}

function parseOptionalPositiveFt(value: string): number | null | undefined {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return parsed;
}

type SymbolFormValues = {
	name: string;
	trade: string;
	widthFt: string;
	heightFt: string;
	serviceId: string;
	active: boolean;
};

function formFromRow(row: SymbolRow): SymbolFormValues {
	return {
		name: row.name,
		trade: row.trade,
		widthFt: row.widthFt ? String(row.widthFt) : "",
		heightFt: row.heightFt ? String(row.heightFt) : "",
		serviceId: row.serviceId ?? NONE,
		active: row.active,
	};
}

export function SymbolsTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [editing, setEditing] = useState<SymbolRow | null>(null);

	const symbols = useQuery(
		trpc.symbols.list.queryOptions({
			q: "",
			sort: "name",
			dir: "asc",
			page: 1,
			pageSize: 100,
		}),
	);

	const services = useQuery(
		trpc.services.list.queryOptions({
			q: "",
			sort: "name",
			dir: "asc",
			page: 1,
			pageSize: 100,
			active: true,
		}),
	);

	const seed = useMutation(
		trpc.symbols.seedRoofing.mutationOptions({
			onSuccess: async (result) => {
				await cache.symbol();
				toast.success(`Loaded ${result.created} symbols.`);
			},
			onError: reportError,
		}),
	);

	const toggleActive = useMutation(
		trpc.symbols.update.mutationOptions({
			onSuccess: (row: { id: string }) => cache.symbol(row.id),
			onError: reportError,
		}),
	);

	const { rows, failed } = useMemo(
		() => parseSymbolRows(symbols.data?.rows),
		[symbols.data],
	);

	const reportedFailureRef = useRef(0);
	useEffect(() => {
		if (failed > 0 && failed !== reportedFailureRef.current) {
			toast.error(
				`${failed} symbol${failed === 1 ? "" : "s"} could not be read.`,
			);
		}
		reportedFailureRef.current = failed;
	}, [failed]);

	const serviceOptions = services.data?.rows ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Symbols</CardTitle>
				<CardDescription>
					Draw a shape on a drawing and use "Save as symbol" to add it here.
				</CardDescription>
				{!symbols.isPending && rows.length === 0 && (
					<CardAction>
						<Button
							disabled={seed.isPending}
							onClick={() => seed.mutate()}
							size="sm"
							variant="outline"
						>
							{seed.isPending ? (
								<Spinner data-icon="inline-start" />
							) : (
								<Icon data-icon="inline-start" icon={Add} />
							)}
							Load starter symbols
						</Button>
					</CardAction>
				)}
			</CardHeader>

			{symbols.isPending ? (
				<CardTableEmpty>
					<Spinner data-icon="inline-start" />
					Loading symbols…
				</CardTableEmpty>
			) : rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={PaintBrush} />
						</EmptyMedia>
						<EmptyTitle>No symbols yet</EmptyTitle>
						<EmptyDescription>
							Start from the roofing starter set, or save your own from a
							drawing.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable columns={COLUMNS}>
					{rows.map((row) => (
						<SimpleTableRow
							clickable
							key={row.id}
							onClick={() => setEditing(row)}
						>
							<TableCell className={`${CELL} font-medium`}>
								{row.name}
							</TableCell>
							<TableCell className={`${CELL} text-muted-foreground`}>
								{row.trade}
							</TableCell>
							<TableCell className={`${CELL} text-muted-foreground`}>
								{sizeLabel(row)}
							</TableCell>
							<TableCell className={`${CELL} truncate text-muted-foreground`}>
								{row.serviceName ?? "—"}
							</TableCell>
							<TableCell className={`${CELL} text-center`}>
								<Switch
									checked={row.active}
									disabled={toggleActive.isPending}
									onCheckedChange={(active) =>
										toggleActive.mutate({ id: row.id, data: { active } })
									}
									onClick={(event) => event.stopPropagation()}
								/>
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			<SymbolDialog
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				open={editing !== null}
				row={editing}
				services={serviceOptions}
			/>
		</Card>
	);
}

function SymbolDialog({
	row,
	open,
	onOpenChange,
	services,
}: {
	row: SymbolRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	services: { id: string; name: string }[];
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [values, setValues] = useState<SymbolFormValues>(() =>
		row
			? formFromRow(row)
			: {
					name: "",
					trade: "roofing",
					widthFt: "",
					heightFt: "",
					serviceId: NONE,
					active: true,
				},
	);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (open && row) setValues(formFromRow(row));
	}, [open, row]);

	const nameId = useId();
	const tradeId = useId();
	const widthId = useId();
	const heightId = useId();
	const serviceFieldId = useId();
	const activeId = useId();

	const update = useMutation(
		trpc.symbols.update.mutationOptions({
			onSuccess: async (result: { id: string }) => {
				await cache.symbol(result.id);
				toast.success("Symbol saved.");
				onOpenChange(false);
			},
			onError: reportError,
		}),
	);

	const remove = useMutation(
		trpc.symbols.delete.mutationOptions({
			onSuccess: async () => {
				await cache.symbol();
				toast.success("Symbol removed.");
				setConfirmingDelete(false);
				onOpenChange(false);
			},
			onError: reportError,
		}),
	);

	const busy = update.isPending || remove.isPending;

	const submit = () => {
		if (!row) return;

		const name = values.name.trim();
		if (!name) {
			toast.error("A symbol needs a name.");
			return;
		}

		const widthFt = parseOptionalPositiveFt(values.widthFt);
		if (widthFt === undefined) {
			toast.error("Width has to be a number greater than zero.");
			return;
		}

		const heightFt = parseOptionalPositiveFt(values.heightFt);
		if (heightFt === undefined) {
			toast.error("Height has to be a number greater than zero.");
			return;
		}

		update.mutate({
			id: row.id,
			data: {
				name,
				trade: values.trade.trim() || "roofing",
				widthFt,
				heightFt,
				serviceId: values.serviceId === NONE ? null : values.serviceId,
				active: values.active,
			},
		});
	};

	const formId = `symbol-form-${row?.id ?? "none"}`;

	return (
		<>
			<Dialog onOpenChange={onOpenChange} open={open}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit symbol</DialogTitle>
					</DialogHeader>

					<form
						className="flex flex-col gap-4"
						id={formId}
						onSubmit={(event) => {
							event.preventDefault();
							submit();
						}}
					>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								autoFocus
								id={nameId}
								onChange={(event) =>
									setValues((prev) => ({ ...prev, name: event.target.value }))
								}
								value={values.name}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor={tradeId}>Trade</FieldLabel>
							<Input
								id={tradeId}
								onChange={(event) =>
									setValues((prev) => ({ ...prev, trade: event.target.value }))
								}
								value={values.trade}
							/>
						</Field>

						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel htmlFor={widthId}>Width (ft)</FieldLabel>
								<Input
									id={widthId}
									inputMode="decimal"
									onChange={(event) =>
										setValues((prev) => ({
											...prev,
											widthFt: event.target.value,
										}))
									}
									placeholder="Optional"
									value={values.widthFt}
								/>
							</Field>

							<Field>
								<FieldLabel htmlFor={heightId}>Height (ft)</FieldLabel>
								<Input
									id={heightId}
									inputMode="decimal"
									onChange={(event) =>
										setValues((prev) => ({
											...prev,
											heightFt: event.target.value,
										}))
									}
									placeholder="Optional"
									value={values.heightFt}
								/>
							</Field>
						</div>

						<Field>
							<FieldLabel htmlFor={serviceFieldId}>Linked service</FieldLabel>
							<Select
								onValueChange={(serviceId) =>
									setValues((prev) => ({ ...prev, serviceId }))
								}
								value={values.serviceId}
							>
								<SelectTrigger className="w-full" id={serviceFieldId}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE}>None</SelectItem>
									{services.map((service) => (
										<SelectItem key={service.id} value={service.id}>
											{service.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>

						<Field orientation="horizontal">
							<FieldLabel htmlFor={activeId}>Active</FieldLabel>
							<Switch
								checked={values.active}
								id={activeId}
								onCheckedChange={(active) =>
									setValues((prev) => ({ ...prev, active }))
								}
							/>
						</Field>
					</form>

					<DialogFooter>
						<Button
							className="sm:mr-auto"
							disabled={busy}
							onClick={() => setConfirmingDelete(true)}
							type="button"
							variant="destructive"
						>
							Delete
						</Button>
						<Button disabled={busy} form={formId} type="submit">
							{update.isPending ? <Spinner data-icon="inline-start" /> : null}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog onOpenChange={setConfirmingDelete} open={confirmingDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {row?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Placed copies keep their measurements, but lose automatic pricing.
						</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={remove.isPending}
							onClick={() => {
								if (row) remove.mutate({ id: row.id });
							}}
							variant="destructive"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
