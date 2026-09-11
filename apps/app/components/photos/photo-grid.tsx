"use client";

import Add from "@carbon/icons-react/es/Add";
import ImageIcon from "@carbon/icons-react/es/Image";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import TrashCan from "@carbon/icons-react/es/TrashCan";
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
import { ImageLightbox } from "@crm/ui/components/image-lightbox";
import { Skeleton } from "@crm/ui/components/skeleton";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { usePhotoUpload } from "@/components/photos/use-photo-upload";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type PhotoRow = RouterOutputs["photos"]["list"]["rows"][number];

const SKELETON_TILES = ["one", "two", "three", "four", "five", "six"];

function thumbUrl(id: string) {
	return `/api/photos/${id}/thumb`;
}

function masterUrl(id: string) {
	return `/api/photos/${id}/master`;
}

export function PhotoGrid({
	dealId,
	contactId,
}: {
	dealId?: string;
	contactId?: string;
}) {
	const trpc = useTRPC();
	const [dragging, setDragging] = useState(false);
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const { upload, uploading } = usePhotoUpload({ dealId, contactId });

	const photos = useQuery({
		...trpc.photos.list.queryOptions({ dealId, contactId }),
		placeholderData: (previous) => previous,
	});

	const rows = photos.data?.rows ?? [];

	const images = rows.map((row) => ({
		src: masterUrl(row.id),
		title: row.filename,
		width: row.width,
		height: row.height,
	}));

	return (
		<div className="flex flex-col gap-4">
			<input
				ref={fileInput}
				type="file"
				accept="image/*"
				multiple
				className="sr-only"
				onChange={(event) => {
					const files = Array.from(event.target.files ?? []);
					event.target.value = "";
					if (files.length > 0) void upload(files);
				}}
			/>

			<button
				type="button"
				disabled={uploading}
				onClick={() => fileInput.current?.click()}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					void upload(Array.from(event.dataTransfer.files));
				}}
				className={cn(
					"flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-muted-foreground text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
					dragging && "bg-muted/50",
				)}
			>
				<Icon icon={Add} />
				Drop images here, or tap to add photos
			</button>

			{photos.isPending ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					{SKELETON_TILES.map((tile) => (
						<Skeleton key={tile} className="aspect-square w-full rounded-lg" />
					))}
				</div>
			) : rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Icon icon={ImageIcon} />
						</EmptyMedia>
						<EmptyTitle>No photos yet</EmptyTitle>
						<EmptyDescription>
							Drop images here or tap Add photos.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					{rows.map((row, index) => (
						<PhotoTile
							key={row.id}
							row={row}
							onOpen={() => setLightboxIndex(index)}
						/>
					))}
				</div>
			)}

			<ImageLightbox
				open={lightboxIndex !== null}
				onOpenChange={(open) => {
					if (!open) setLightboxIndex(null);
				}}
				images={images}
				index={lightboxIndex ?? 0}
				onIndexChange={setLightboxIndex}
			/>
		</div>
	);
}

function PhotoTile({ row, onOpen }: { row: PhotoRow; onOpen: () => void }) {
	const [deleting, setDeleting] = useState(false);
	const url = thumbUrl(row.id);

	return (
		<div className="group relative flex flex-col gap-2 rounded-lg border bg-card p-2">
			<button
				type="button"
				onClick={onOpen}
				className="relative aspect-square w-full overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<Image
					src={url}
					alt={row.filename}
					fill
					unoptimized={!isOptimizable(url)}
					className="object-cover"
				/>
				<span className="sr-only">Open {row.filename}</span>
			</button>

			<div className="absolute top-1.5 right-1.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="icon-xs">
							<Icon icon={OverflowMenuVertical} />
							<span className="sr-only">More actions for {row.filename}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-44">
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

			<DeletePhotoDialog
				photoId={row.id}
				filename={row.filename}
				open={deleting}
				onOpenChange={setDeleting}
			/>
		</div>
	);
}

function DeletePhotoDialog({
	photoId,
	filename,
	open,
	onOpenChange,
}: {
	photoId: string;
	filename: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const cache = useCrmCache();
	const [deleting, setDeleting] = useState(false);

	const remove = async () => {
		setDeleting(true);
		try {
			const response = await fetch(`/api/photos/${photoId}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				toast.error("Could not delete that photo.");
				return;
			}
			await Promise.all([cache.photos(), cache.estimate(), cache.invoice()]);
			onOpenChange(false);
		} finally {
			setDeleting(false);
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {filename}?</AlertDialogTitle>
					<AlertDialogDescription>
						This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={deleting}
						onClick={() => void remove()}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
