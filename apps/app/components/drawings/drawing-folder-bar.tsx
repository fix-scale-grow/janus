"use client";

import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import Edit from "@carbon/icons-react/es/Edit";
import Folder from "@carbon/icons-react/es/Folder";
import FolderAdd from "@carbon/icons-react/es/FolderAdd";
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
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type FolderRow = RouterOutputs["drawings"]["folders"][number];

export function DrawingFolderBar({
	activeFolder,
	onSelect,
}: {
	activeFolder: string;
	onSelect: (folderId: string) => void;
}) {
	const trpc = useTRPC();
	const folders = useQuery(trpc.drawings.folders.queryOptions());
	const [creating, setCreating] = useState(false);
	const [renaming, setRenaming] = useState<FolderRow | null>(null);
	const [deleting, setDeleting] = useState<FolderRow | null>(null);

	const rows = folders.data ?? [];

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<Button
				onClick={() => onSelect("all")}
				size="sm"
				variant={activeFolder === "all" ? "secondary" : "ghost"}
			>
				All drawings
			</Button>

			{rows.map((folder) => {
				const active = activeFolder === folder.id;
				return (
					<span className="flex items-center" key={folder.id}>
						<Button
							onClick={() => onSelect(folder.id)}
							size="sm"
							variant={active ? "secondary" : "ghost"}
						>
							<Icon icon={Folder} data-icon="inline-start" />
							{folder.name}
							<Badge variant="outline">{folder.drawingCount}</Badge>
						</Button>
						{active && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										aria-label={`Folder actions for ${folder.name}`}
										size="icon-xs"
										variant="ghost"
									>
										<Icon icon={ChevronDown} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem onSelect={() => setRenaming(folder)}>
										<Icon icon={Edit} />
										Rename folder
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={() => setDeleting(folder)}
										variant="destructive"
									>
										<Icon icon={TrashCan} />
										Delete folder
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</span>
				);
			})}

			<Button onClick={() => setCreating(true)} size="sm" variant="ghost">
				<Icon icon={FolderAdd} data-icon="inline-start" />
				New folder
			</Button>

			<FolderNameDialog
				key={creating ? "create-open" : "create-closed"}
				folder={null}
				onOpenChange={setCreating}
				open={creating}
			/>
			<FolderNameDialog
				key={renaming?.id ?? "rename-closed"}
				folder={renaming}
				onOpenChange={(open) => {
					if (!open) setRenaming(null);
				}}
				open={renaming !== null}
			/>
			<DeleteFolderDialog
				folder={deleting}
				onDeleted={() => onSelect("all")}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
			/>
		</div>
	);
}

function FolderNameDialog({
	folder,
	open,
	onOpenChange,
}: {
	folder: FolderRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [name, setName] = useState(folder?.name ?? "");
	const inputId = useId();
	const formId = useId();

	const create = useMutation(
		trpc.drawings.createFolder.mutationOptions({
			onSuccess: () => {
				void cache.drawing();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const rename = useMutation(
		trpc.drawings.renameFolder.mutationOptions({
			onSuccess: () => {
				void cache.drawing();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const pending = create.isPending || rename.isPending;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle>
				</DialogHeader>

				<form
					id={formId}
					onSubmit={(event) => {
						event.preventDefault();
						const trimmed = name.trim();
						if (!trimmed) return;
						if (folder) {
							rename.mutate({ id: folder.id, name: trimmed });
						} else {
							create.mutate({ name: trimmed });
						}
					}}
				>
					<Input
						autoComplete="off"
						autoFocus
						id={inputId}
						onChange={(event) => setName(event.target.value)}
						placeholder="Folder name"
						value={name}
					/>
				</form>

				<DialogFooter>
					<Button
						disabled={pending || !name.trim()}
						form={formId}
						type="submit"
					>
						{folder ? "Save" : "Create folder"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DeleteFolderDialog({
	folder,
	onDeleted,
	onOpenChange,
}: {
	folder: FolderRow | null;
	onDeleted: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const remove = useMutation(
		trpc.drawings.deleteFolder.mutationOptions({
			onSuccess: () => {
				void cache.drawing();
				onOpenChange(false);
				onDeleted();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<AlertDialog onOpenChange={onOpenChange} open={folder !== null}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {folder?.name}?</AlertDialogTitle>
					<AlertDialogDescription>
						The drawings inside stay — they go back to All drawings.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={remove.isPending}
						onClick={() => {
							if (folder) remove.mutate({ id: folder.id });
						}}
						variant="destructive"
					>
						Delete folder
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
