"use client";

import Draw from "@carbon/icons-react/es/Draw";
import Edit from "@carbon/icons-react/es/Edit";
import ImageIcon from "@carbon/icons-react/es/Image";
import LinkIcon from "@carbon/icons-react/es/Link";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import Satellite from "@carbon/icons-react/es/Satellite";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Unlink from "@carbon/icons-react/es/Unlink";
import { isOptimizable } from "@crm/db/images";
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
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { type CarbonIcon, Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Skeleton } from "@crm/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@crm/ui/components/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	type DrawingAttachment,
	drawingsSearchParams,
} from "@/app/(app)/[slug]/drawings/drawings-search-params";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { AttachDrawingDialog } from "./attach-drawing-dialog";

type DrawingRow = RouterOutputs["drawings"]["list"]["rows"][number];

const ATTACHMENT_TABS: { value: string; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "deal", label: "On a job" },
	{ value: "unattached", label: "Unattached" },
];

const SKELETON_TILES = ["one", "two", "three", "four"];

const BACKGROUND_ICON: Record<DrawingRow["background"], CarbonIcon> = {
	WHITEBOARD: Draw,
	IMAGE: ImageIcon,
	SATELLITE: Satellite,
};

export function DrawingGrid({
	dealId,
	contactId,
}: {
	dealId?: string;
	contactId?: string;
} = {}) {
	const embedded = Boolean(dealId || contactId);

	return embedded ? (
		<EmbeddedDrawingGrid dealId={dealId} contactId={contactId} />
	) : (
		<PageDrawingGrid />
	);
}

function PageDrawingGrid() {
	const trpc = useTRPC();
	const { query, input } = useTableQuery(drawingsSearchParams);

	const drawings = useQuery({
		...trpc.drawings.list.queryOptions({
			...input,
			attachment: input.attachment as DrawingAttachment,
		}),
		placeholderData: (previous) => previous,
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Tabs value={query.tab} onValueChange={query.setTab}>
					<TabsList>
						{ATTACHMENT_TABS.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<ListSearch placeholder="Search drawings…" />
			</div>

			<DrawingGridBody
				rows={drawings.data?.rows ?? []}
				loading={drawings.isPending}
				empty="No drawings match this view."
			/>
		</div>
	);
}

function EmbeddedDrawingGrid({
	dealId,
	contactId,
}: {
	dealId?: string;
	contactId?: string;
}) {
	const trpc = useTRPC();

	const drawings = useQuery({
		...trpc.drawings.list.queryOptions({
			q: "",
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 60,
			attachment: "all",
			dealId,
			contactId,
		}),
		placeholderData: (previous) => previous,
	});

	return (
		<DrawingGridBody
			rows={drawings.data?.rows ?? []}
			loading={drawings.isPending}
			empty="No drawings on this job yet."
		/>
	);
}

function DrawingGridBody({
	rows,
	loading,
	empty,
}: {
	rows: DrawingRow[];
	loading: boolean;
	empty: string;
}) {
	if (loading) {
		return (
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{SKELETON_TILES.map((tile) => (
					<Skeleton key={tile} className="aspect-square w-full rounded-lg" />
				))}
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Icon icon={Draw} />
					</EmptyMedia>
					<EmptyTitle>No drawings</EmptyTitle>
					<EmptyDescription>{empty}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
			{rows.map((row) => (
				<DrawingCard key={row.id} row={row} />
			))}
		</div>
	);
}

function DrawingCard({ row }: { row: DrawingRow }) {
	const workspaceUrl = useWorkspaceUrl();
	const href = workspaceUrl(`/drawings/${row.id}`);
	const [renaming, setRenaming] = useState(false);
	const [attaching, setAttaching] = useState(false);
	const [deleting, setDeleting] = useState(false);

	return (
		<div className="group relative flex flex-col gap-2 rounded-lg border bg-card p-2">
			<div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
				{row.thumbnailUrl ? (
					<Image
						src={row.thumbnailUrl}
						alt={row.title}
						fill
						unoptimized={!isOptimizable(row.thumbnailUrl)}
						className="object-cover"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground">
						<Icon icon={BACKGROUND_ICON[row.background]} className="size-8" />
					</div>
				)}
			</div>

			<div className="min-w-0 px-1 pb-1">
				<p className="truncate text-sm font-medium">{row.title}</p>
				{row.dealName ? (
					<p className="truncate text-muted-foreground text-xs">
						on {row.dealName}
					</p>
				) : null}
				<p className="text-muted-foreground text-xs">
					<LocalRelativeTime date={row.updatedAt} />
				</p>
			</div>

			<Link
				href={href}
				className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<span className="sr-only">{row.title}</span>
			</Link>

			<div className="absolute top-1.5 right-1.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="icon-xs">
							<Icon icon={OverflowMenuVertical} />
							<span className="sr-only">More actions for {row.title}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-44">
						<DropdownMenuItem onSelect={() => setRenaming(true)}>
							<Icon icon={Edit} />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setAttaching(true)}>
							<Icon icon={row.dealId ? Unlink : LinkIcon} />
							{row.dealId ? "Detach" : "Attach to job…"}
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => setDeleting(true)}
						>
							<Icon icon={TrashCan} />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<RenameDrawingDialog
				drawingId={row.id}
				title={row.title}
				open={renaming}
				onOpenChange={setRenaming}
			/>
			<AttachDrawingDialog
				drawingId={row.id}
				dealId={row.dealId}
				dealName={row.dealName}
				open={attaching}
				onOpenChange={setAttaching}
			/>
			<DeleteDrawingDialog
				drawingId={row.id}
				title={row.title}
				open={deleting}
				onOpenChange={setDeleting}
			/>
		</div>
	);
}

function RenameDrawingDialog({
	drawingId,
	title,
	open,
	onOpenChange,
}: {
	drawingId: string;
	title: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [value, setValue] = useState(title);
	const inputId = useId();

	const rename = useMutation(
		trpc.drawings.rename.mutationOptions({
			onSuccess: () => {
				void cache.drawing(drawingId);
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) setValue(title);
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename drawing</DialogTitle>
				</DialogHeader>

				<form
					id={`rename-drawing-${drawingId}`}
					onSubmit={(event) => {
						event.preventDefault();
						if (!value.trim()) return;
						rename.mutate({ id: drawingId, title: value.trim() });
					}}
				>
					<Input
						id={inputId}
						value={value}
						onChange={(event) => setValue(event.target.value)}
						autoFocus
						autoComplete="off"
					/>
				</form>

				<DialogFooter>
					<Button
						type="submit"
						form={`rename-drawing-${drawingId}`}
						disabled={rename.isPending || !value.trim()}
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DeleteDrawingDialog({
	drawingId,
	title,
	open,
	onOpenChange,
}: {
	drawingId: string;
	title: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const remove = useMutation(
		trpc.drawings.delete.mutationOptions({
			onSuccess: () => {
				void cache.drawing();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {title}?</AlertDialogTitle>
					<AlertDialogDescription>
						Its version history goes too. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						onClick={() => remove.mutate({ id: drawingId })}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
