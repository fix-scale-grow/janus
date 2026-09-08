"use client";

import Add from "@carbon/icons-react/es/Add";
import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import PaintBrush from "@carbon/icons-react/es/PaintBrush";
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
} from "@crm/ui/components/alert-dialog";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { CardTableEmpty } from "@crm/ui/components/card-table";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@crm/ui/components/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { TableCell } from "@crm/ui/components/table";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { parseSymbolRowsWith, symbolRowBase } from "@/lib/symbol-rows";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { SymbolsBulkActions } from "./symbols-bulk-actions";

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

const COLUMNS: SimpleTableColumn[] = [
	{ id: "select", srLabel: "Select", width: "w-10" },
	{ id: "name", header: "Name" },
	{ id: "size", header: "Size", width: "w-32" },
	{ id: "service", header: "Service", width: "w-40" },
	{ id: "active", header: "Active", width: "w-16", align: "center" },
	{ id: "delete", srLabel: "Delete", width: "w-10" },
];

const CELL = "px-3 py-2.5 align-middle";

const SYMBOL_PACKS = [
	{ key: "roofing", label: "Roofing" },
	{ key: "landscaping", label: "Landscaping" },
	{ key: "building", label: "General building" },
] as const;

const CATEGORIES_OPEN_KEY = "janus.settings.symbolCategoriesOpen";

function readCategoriesOpen(): Record<string, boolean> {
	try {
		const stored = window.localStorage.getItem(CATEGORIES_OPEN_KEY);
		if (!stored) return {};
		const parsed: unknown = JSON.parse(stored);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const result: Record<string, boolean> = {};
		for (const [key, value] of Object.entries(
			parsed as Record<string, unknown>,
		)) {
			if (typeof value === "boolean") result[key] = value;
		}
		return result;
	} catch {
		return {};
	}
}

function writeCategoriesOpen(open: Record<string, boolean>): void {
	try {
		window.localStorage.setItem(CATEGORIES_OPEN_KEY, JSON.stringify(open));
	} catch {}
}

function sizeLabel(row: SymbolRow): string {
	if (row.widthFt && row.heightFt) {
		return `${row.widthFt} × ${row.heightFt} ft`;
	}
	if (row.widthFt) return `${row.widthFt} ft wide`;
	if (row.heightFt) return `${row.heightFt} ft tall`;
	return "—";
}

type CategoryGroup = { key: string; label: string; symbols: SymbolRow[] };

function groupByCategory(rows: SymbolRow[]): CategoryGroup[] {
	const byKey = new Map<string, CategoryGroup>();
	for (const row of rows) {
		const label = row.trade.trim();
		const key = label.toLowerCase();
		const existing = byKey.get(key);
		if (existing) {
			existing.symbols.push(row);
		} else {
			byKey.set(key, { key, label, symbols: [row] });
		}
	}
	return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function SymbolsTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const [deleting, setDeleting] = useState<SymbolRow | null>(null);
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [categoriesOpen, setCategoriesOpen] = useState<Record<string, boolean>>(
		{},
	);

	useEffect(() => {
		setCategoriesOpen(readCategoriesOpen());
	}, []);

	const symbols = useQuery(
		trpc.symbols.list.queryOptions({
			q: "",
			sort: "name",
			dir: "asc",
			page: 1,
			pageSize: 100,
		}),
	);

	const seed = useMutation(
		trpc.symbols.seedPack.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.symbol();
				const pack = SYMBOL_PACKS.find((entry) => entry.key === variables.pack);
				const label = pack?.label.toLowerCase() ?? variables.pack;
				toast.success(
					result.created === 0
						? "Already installed."
						: `Added ${result.created} ${label} symbol${result.created === 1 ? "" : "s"}.`,
				);
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

	const remove = useMutation(
		trpc.symbols.delete.mutationOptions({
			onSuccess: async () => {
				await cache.symbol();
				toast.success("Symbol removed.");
				setDeleting(null);
			},
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

	const rowIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
	useEffect(() => {
		setSelected((prev) => {
			if (prev.size === 0) return prev;
			const next = new Set<string>();
			for (const id of prev) if (rowIds.has(id)) next.add(id);
			return next.size === prev.size ? prev : next;
		});
	}, [rowIds]);

	const categories = useMemo(() => groupByCategory(rows), [rows]);

	const setCategoryOpen = (key: string, isOpen: boolean) => {
		setCategoriesOpen((prev) => {
			const next = { ...prev, [key]: isOpen };
			writeCategoriesOpen(next);
			return next;
		});
	};

	const toggleRow = (id: string, checked: boolean) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const toggleGroup = (group: CategoryGroup, checked: boolean) => {
		setSelected((prev) => {
			const next = new Set(prev);
			for (const symbol of group.symbols) {
				if (checked) next.add(symbol.id);
				else next.delete(symbol.id);
			}
			return next;
		});
	};

	const selectedIds = useMemo(() => Array.from(selected), [selected]);
	const clearSelection = () => setSelected(new Set());

	return (
		<Card>
			<CardHeader>
				<CardTitle>Symbols</CardTitle>
				<CardDescription>
					Open a symbol to draw its shape and set how it prices.
				</CardDescription>
				{!symbols.isPending && (
					<CardAction>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button disabled={seed.isPending} size="sm" variant="outline">
									{seed.isPending ? (
										<Spinner data-icon="inline-start" />
									) : (
										<Icon data-icon="inline-start" icon={Add} />
									)}
									Install pack
									<Icon data-icon="inline-end" icon={ChevronDown} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{SYMBOL_PACKS.map((pack) => (
									<DropdownMenuItem
										key={pack.key}
										onSelect={() => seed.mutate({ pack: pack.key })}
									>
										{pack.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
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
							Install a starter pack above, or draw your own.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="flex flex-col gap-3">
					{selectedIds.length > 0 && (
						<SymbolsBulkActions
							categories={categories}
							ids={selectedIds}
							onDone={clearSelection}
						/>
					)}

					{categories.map((category) => {
						const isOpen = categoriesOpen[category.key] ?? true;
						const selectedInGroup = category.symbols.filter((symbol) =>
							selected.has(symbol.id),
						).length;
						const groupAllSelected =
							selectedInGroup === category.symbols.length;
						const groupChecked: boolean | "indeterminate" = groupAllSelected
							? true
							: selectedInGroup > 0
								? "indeterminate"
								: false;

						return (
							<Collapsible
								key={category.key}
								onOpenChange={(next) => setCategoryOpen(category.key, next)}
								open={isOpen}
							>
								<div className="overflow-hidden rounded-lg border bg-card">
									<CollapsibleTrigger asChild>
										<button
											className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
											type="button"
										>
											<Icon
												className={cn(
													"size-4 shrink-0 text-muted-foreground transition-transform",
													isOpen && "rotate-90",
												)}
												icon={ChevronRight}
											/>
											<span className="font-medium text-sm">
												{category.label}
											</span>
											<Badge variant="outline">{category.symbols.length}</Badge>
											<span className="flex-1" />
											<Checkbox
												aria-label={`Select all in ${category.label}`}
												checked={groupChecked}
												onCheckedChange={(checked) =>
													toggleGroup(category, checked === true)
												}
												onClick={(event) => event.stopPropagation()}
											/>
										</button>
									</CollapsibleTrigger>

									<CollapsibleContent>
										<SimpleTable
											columns={COLUMNS}
											containerClassName="rounded-none border-0 border-t"
										>
											{category.symbols.map((row) => (
												<SimpleTableRow
													clickable
													key={row.id}
													onClick={() =>
														router.push(
															workspaceUrl(`/settings/symbols/${row.id}`),
														)
													}
												>
													<TableCell className={CELL}>
														<Checkbox
															aria-label={`Select ${row.name}`}
															checked={selected.has(row.id)}
															onCheckedChange={(checked) =>
																toggleRow(row.id, checked === true)
															}
															onClick={(event) => event.stopPropagation()}
														/>
													</TableCell>
													<TableCell className={`${CELL} font-medium`}>
														{row.name}
													</TableCell>
													<TableCell
														className={`${CELL} text-muted-foreground`}
													>
														{sizeLabel(row)}
													</TableCell>
													<TableCell
														className={`${CELL} truncate text-muted-foreground`}
													>
														{row.serviceName ?? "—"}
													</TableCell>
													<TableCell className={`${CELL} text-center`}>
														<Switch
															checked={row.active}
															disabled={toggleActive.isPending}
															onCheckedChange={(active) =>
																toggleActive.mutate({
																	id: row.id,
																	data: { active },
																})
															}
															onClick={(event) => event.stopPropagation()}
														/>
													</TableCell>
													<TableCell className={`${CELL} text-right`}>
														<Button
															onClick={(event) => {
																event.stopPropagation();
																setDeleting(row);
															}}
															size="icon-sm"
															variant="ghost"
														>
															<Icon icon={TrashCan} />
														</Button>
													</TableCell>
												</SimpleTableRow>
											))}
										</SimpleTable>
									</CollapsibleContent>
								</div>
							</Collapsible>
						);
					})}
				</div>
			)}

			<AlertDialog
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				open={deleting !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Placed copies keep their measurements, but lose automatic pricing.
						</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={remove.isPending}
							onClick={() => {
								if (deleting) remove.mutate({ id: deleting.id });
							}}
							variant="destructive"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}
