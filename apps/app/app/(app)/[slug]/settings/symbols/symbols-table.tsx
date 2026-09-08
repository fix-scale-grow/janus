"use client";

import Add from "@carbon/icons-react/es/Add";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { parseSymbolRowsWith, symbolRowBase } from "@/lib/symbol-rows";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

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
	{ id: "name", header: "Name" },
	{ id: "trade", header: "Trade", width: "w-32" },
	{ id: "size", header: "Size", width: "w-32" },
	{ id: "service", header: "Service", width: "w-40" },
	{ id: "active", header: "Active", width: "w-16", align: "center" },
	{ id: "delete", srLabel: "Delete", width: "w-10" },
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

export function SymbolsTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const [deleting, setDeleting] = useState<SymbolRow | null>(null);

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

	return (
		<Card>
			<CardHeader>
				<CardTitle>Symbols</CardTitle>
				<CardDescription>
					Open a symbol to draw its shape and set how it prices.
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
							Start from the roofing starter set, or draw your own.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable columns={COLUMNS}>
					{rows.map((row) => (
						<SimpleTableRow
							clickable
							key={row.id}
							onClick={() =>
								router.push(workspaceUrl(`/settings/symbols/${row.id}`))
							}
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
