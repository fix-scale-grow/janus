"use client";

import Add from "@carbon/icons-react/es/Add";
import ColorPalette from "@carbon/icons-react/es/ColorPalette";
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
import { Card, CardHeader, CardTitle } from "@crm/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { TableCell } from "@crm/ui/components/table";
import { cn } from "@crm/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	CREW_COLOR_CLASSES,
	NO_CREW_CLASSES,
} from "@/components/crews/crew-colors";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type CrewRow = RouterOutputs["crews"]["list"][number];

const CREW_COLORS = [
	"red",
	"orange",
	"amber",
	"green",
	"teal",
	"sky",
	"indigo",
	"violet",
	"pink",
	"slate",
] as const;

type CrewColor = (typeof CREW_COLORS)[number];

const COLUMNS: SimpleTableColumn[] = [
	{
		id: "color",
		header: <span className="sr-only">Colour</span>,
		width: "w-10",
	},
	{ id: "name", header: "Name" },
	{ id: "taskCount", header: "Tasks", width: "w-20", align: "right" },
	{ id: "status", header: "Status", width: "w-28" },
	{
		id: "actions",
		header: <span className="sr-only">Actions</span>,
		width: "w-36",
		align: "right",
	},
];

const CELL = "px-3 py-2.5 align-middle";

function nextUnusedColor(rows: CrewRow[]): CrewColor {
	const used = new Set(rows.map((row) => row.color));
	return CREW_COLORS.find((color) => !used.has(color)) ?? CREW_COLORS[0];
}

function ColorSwatchPicker({
	value,
	onSelect,
}: {
	value: string;
	onSelect: (color: CrewColor) => void;
}) {
	return (
		<div className="grid grid-cols-5 gap-1.5 p-1">
			{CREW_COLORS.map((color) => (
				<button
					key={color}
					type="button"
					aria-label={color}
					aria-pressed={value === color}
					onClick={() => onSelect(color)}
					className={cn(
						"size-6 rounded-full ring-offset-2 ring-offset-popover",
						CREW_COLOR_CLASSES[color]?.dot,
						value === color && "ring-2 ring-foreground",
					)}
				/>
			))}
		</div>
	);
}

function CrewColorDot({
	color,
	label,
	onSelect,
}: {
	color: string;
	label: string;
	onSelect: (color: CrewColor) => void;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={label}
					className={cn(
						"size-4 rounded-full",
						(CREW_COLOR_CLASSES[color] ?? NO_CREW_CLASSES).dot,
					)}
				/>
			</PopoverTrigger>
			<PopoverContent size="fit" align="start" className="p-2">
				<ColorSwatchPicker value={color} onSelect={onSelect} />
			</PopoverContent>
		</Popover>
	);
}

function CrewNameCell({
	row,
	onSave,
}: {
	row: CrewRow;
	onSave: (name: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(row.name);

	if (!editing) {
		return (
			<button
				type="button"
				className="truncate text-left font-medium hover:underline"
				onClick={() => {
					setValue(row.name);
					setEditing(true);
				}}
			>
				{row.name}
			</button>
		);
	}

	const commit = () => {
		setEditing(false);
		const trimmed = value.trim();
		if (trimmed && trimmed !== row.name) onSave(trimmed);
	};

	return (
		<Input
			autoFocus
			value={value}
			onChange={(event) => setValue(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit();
				}
				if (event.key === "Escape") {
					setEditing(false);
					setValue(row.name);
				}
			}}
		/>
	);
}

export function CrewsTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState<CrewColor | null>(null);

	const crews = useQuery(trpc.crews.list.queryOptions());
	const rows = crews.data ?? [];
	const selectedColor = newColor ?? nextUnusedColor(rows);

	const update = useMutation(
		trpc.crews.update.mutationOptions({
			onSuccess: () => cache.crews(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const remove = useMutation(
		trpc.crews.remove.mutationOptions({
			onSuccess: () => cache.crews(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const create = useMutation(
		trpc.crews.create.mutationOptions({
			onSuccess: () => {
				cache.crews();
				setNewName("");
				setNewColor(null);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submitCreate = () => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		create.mutate({ name: trimmed, color: selectedColor });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Crews</CardTitle>
			</CardHeader>

			{crews.isPending ? (
				<div className="flex items-center justify-center gap-2 rounded-lg border bg-card p-10 text-muted-foreground text-xs">
					<Spinner data-icon="inline-start" />
					Loading crews…
				</div>
			) : rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={ColorPalette} />
						</EmptyMedia>
						<EmptyTitle>No crews yet</EmptyTitle>
						<EmptyDescription>
							Add a crew below to start assigning tasks.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<SimpleTable columns={COLUMNS}>
					{rows.map((row) => (
						<SimpleTableRow key={row.id}>
							<TableCell className={CELL}>
								<CrewColorDot
									color={row.color}
									label={`Change ${row.name}'s colour`}
									onSelect={(color) => update.mutate({ id: row.id, color })}
								/>
							</TableCell>
							<TableCell className={CELL}>
								<CrewNameCell
									row={row}
									onSave={(name) => update.mutate({ id: row.id, name })}
								/>
							</TableCell>
							<TableCell
								className={cn(
									CELL,
									"text-right tabular-nums text-muted-foreground",
								)}
							>
								{row.taskCount}
							</TableCell>
							<TableCell className={CELL}>
								{row.archived ? (
									<Badge variant="outline">Archived</Badge>
								) : null}
							</TableCell>
							<TableCell className={cn(CELL, "text-right")}>
								<div className="flex items-center justify-end gap-1">
									<Button
										variant="ghost"
										size="sm"
										disabled={update.isPending}
										onClick={() =>
											update.mutate({ id: row.id, archived: !row.archived })
										}
									>
										{row.archived ? "Unarchive" : "Archive"}
									</Button>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Delete ${row.name}`}
											>
												<Icon icon={TrashCan} />
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>Delete {row.name}?</AlertDialogTitle>
												<AlertDialogDescription>
													This cannot be undone.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													variant="destructive"
													onClick={() => remove.mutate({ id: row.id })}
												>
													Delete
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</TableCell>
						</SimpleTableRow>
					))}
				</SimpleTable>
			)}

			<div className="flex items-center gap-2 rounded-lg border bg-card p-3">
				<CrewColorDot
					color={selectedColor}
					label="Choose colour"
					onSelect={setNewColor}
				/>
				<Input
					placeholder="New crew name"
					value={newName}
					onChange={(event) => setNewName(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							submitCreate();
						}
					}}
				/>
				<Button
					size="sm"
					disabled={create.isPending || !newName.trim()}
					onClick={submitCreate}
				>
					<Icon icon={Add} data-icon="inline-start" />
					Add crew
				</Button>
			</div>
		</Card>
	);
}
