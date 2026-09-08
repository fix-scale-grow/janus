"use client";

import Flag from "@carbon/icons-react/es/Flag";
import FlagFilled from "@carbon/icons-react/es/FlagFilled";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
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
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	ARCHIVE_STAGE,
	CANCEL,
	DELETE_STAGE,
	DELETE_STAGE_BODY,
	deleteStageTitle,
	ENTRY_DISABLED_HELP,
	ENTRY_HELP,
	MAKE_ENTRY,
	OUTCOME_LABEL,
	RESTORE_STAGE,
} from "./pipeline-copy";
import { SwatchPicker } from "./swatch-picker";

export type Stage =
	RouterOutputs["pipelines"]["list"][number]["stages"][number];

const OUTCOMES = Object.keys(OUTCOME_LABEL) as (keyof typeof OUTCOME_LABEL)[];

export function StageRow({
	stage,
	className,
	onDelete,
}: {
	stage: Stage;
	className?: string;
	onDelete?: (id: string) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [label, setLabel] = useState(stage.label);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const archived = stage.archivedAt !== null;

	const update = useMutation(
		trpc.pipelines.updateStage.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const archive = useMutation(
		trpc.pipelines.archiveStage.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const restore = useMutation(
		trpc.pipelines.restoreStage.mutationOptions({
			onSuccess: () => cache.pipeline(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const del = useMutation(
		trpc.pipelines.deleteStage.mutationOptions({
			onSuccess: () => {
				onDelete?.(stage.id);
				return cache.pipeline();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const commitLabel = () => {
		const trimmed = label.trim();
		if (trimmed === "") {
			setLabel(stage.label);
			return;
		}
		if (trimmed !== stage.label) {
			update.mutate({ id: stage.id, data: { label: trimmed } });
		}
	};

	const entryDisabled = archived || stage.isEntry || stage.outcome !== "OPEN";

	return (
		<div className={className}>
			<SwatchPicker
				value={stage.color}
				disabled={archived}
				onChange={(color) => update.mutate({ id: stage.id, data: { color } })}
			/>

			<Input
				aria-label="Stage label"
				value={label}
				disabled={archived}
				className="h-7 min-w-0 flex-1"
				onChange={(event) => setLabel(event.target.value)}
				onBlur={commitLabel}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
				}}
			/>

			<Select
				value={stage.outcome}
				disabled={archived}
				onValueChange={(outcome) =>
					update.mutate({
						id: stage.id,
						data: { outcome: outcome as Stage["outcome"] },
					})
				}
			>
				<SelectTrigger className="h-7 w-32 shrink-0">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{OUTCOMES.map((outcome) => (
						<SelectItem key={outcome} value={outcome}>
							{OUTCOME_LABEL[outcome]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						disabled={entryDisabled}
						onClick={() =>
							update.mutate({ id: stage.id, data: { isEntry: true } })
						}
						className="shrink-0"
					>
						<Icon icon={stage.isEntry ? FlagFilled : Flag} />
						<span className="sr-only">{MAKE_ENTRY}</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					{stage.isEntry
						? ENTRY_HELP
						: stage.outcome !== "OPEN"
							? ENTRY_DISABLED_HELP
							: MAKE_ENTRY}
				</TooltipContent>
			</Tooltip>

			{archived ? (
				<div className="flex shrink-0 items-center gap-1.5">
					<Button
						variant="outline"
						size="xs"
						onClick={() => restore.mutate({ id: stage.id })}
					>
						{RESTORE_STAGE}
					</Button>
					<Button
						variant="ghost"
						size="xs"
						onClick={() => setConfirmingDelete(true)}
					>
						{DELETE_STAGE}
					</Button>
					<AlertDialog
						open={confirmingDelete}
						onOpenChange={setConfirmingDelete}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{deleteStageTitle(stage.label)}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{DELETE_STAGE_BODY}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{CANCEL}</AlertDialogCancel>
								<AlertDialogAction
									variant="destructive"
									onClick={() => del.mutate({ id: stage.id })}
								>
									{DELETE_STAGE}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			) : (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-xs" className="shrink-0">
							<Icon icon={OverflowMenuVertical} />
							<span className="sr-only">More for {stage.label}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							disabled={stage.isEntry}
							onSelect={() => archive.mutate({ id: stage.id })}
						>
							{ARCHIVE_STAGE}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
