"use client";

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
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const NEW_CATEGORY = "__new__";
const TRADE_MAX_LENGTH = 60;

export function SymbolsBulkActions({
	ids,
	categories,
	onDone,
}: {
	ids: string[];
	categories: { key: string; label: string }[];
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [confirming, setConfirming] = useState(false);
	const [addingCategory, setAddingCategory] = useState(false);
	const [newCategory, setNewCategory] = useState("");

	const onError = (error: { message: string }) => toast.error(error.message);

	const move = useMutation(
		trpc.symbols.bulkSetTrade.mutationOptions({
			onSuccess: async (result) => {
				await cache.symbol();
				toast.success(`Moved ${formatCount(result.count, "symbol")}.`);
				setAddingCategory(false);
				setNewCategory("");
				onDone();
			},
			onError,
		}),
	);

	const remove = useMutation(
		trpc.symbols.bulkDelete.mutationOptions({
			onSuccess: async (result) => {
				await cache.symbol();
				toast.success(`Deleted ${formatCount(result.count, "symbol")}.`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	const pending = move.isPending || remove.isPending;

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
			<span className="font-medium text-xs">
				{formatCount(ids.length, "symbol")} selected
			</span>

			<div className="flex flex-1 flex-wrap items-center justify-end gap-2">
				{addingCategory ? (
					<>
						<Input
							autoFocus
							className="h-8 w-40"
							maxLength={TRADE_MAX_LENGTH}
							onChange={(event) => setNewCategory(event.target.value)}
							placeholder="New category"
							value={newCategory}
						/>
						<Button
							disabled={pending || newCategory.trim().length === 0}
							onClick={() => move.mutate({ ids, trade: newCategory.trim() })}
							size="sm"
						>
							Move
						</Button>
						<Button
							disabled={pending}
							onClick={() => {
								setAddingCategory(false);
								setNewCategory("");
							}}
							size="sm"
							variant="ghost"
						>
							Cancel
						</Button>
					</>
				) : (
					<Select
						disabled={pending}
						onValueChange={(next) => {
							if (next === NEW_CATEGORY) {
								setAddingCategory(true);
								return;
							}
							move.mutate({ ids, trade: next });
						}}
						value=""
					>
						<SelectTrigger className="h-8 w-44">
							<SelectValue placeholder="Move to category" />
						</SelectTrigger>
						<SelectContent>
							{categories.map((category) => (
								<SelectItem key={category.key} value={category.label}>
									{category.label}
								</SelectItem>
							))}
							<SelectItem value={NEW_CATEGORY}>New category…</SelectItem>
						</SelectContent>
					</Select>
				)}

				<Button
					disabled={pending}
					onClick={() => setConfirming(true)}
					size="sm"
					variant="destructive"
				>
					<Icon data-icon="inline-start" icon={TrashCan} />
					Delete
				</Button>
			</div>

			<AlertDialog onOpenChange={setConfirming} open={confirming}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {formatCount(ids.length, "symbol")}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Placed copies stay on drawings but lose their auto-pricing link.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={remove.isPending}
							onClick={() => remove.mutate({ ids })}
							variant="destructive"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
