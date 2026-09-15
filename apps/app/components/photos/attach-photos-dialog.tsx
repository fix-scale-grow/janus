"use client";

import Add from "@carbon/icons-react/es/Add";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import ImageIcon from "@carbon/icons-react/es/Image";
import { isOptimizable } from "@crm/db/images";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { Skeleton } from "@crm/ui/components/skeleton";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useRef } from "react";
import { usePhotoUpload } from "@/components/photos/use-photo-upload";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type PhotoRow = RouterOutputs["photos"]["list"]["rows"][number];

const SKELETON_TILES = ["one", "two", "three", "four", "five", "six"];

function thumbUrl(id: string) {
	return `/api/photos/${id}/thumb`;
}

export function AttachPhotosDialog({
	open,
	onOpenChange,
	dealId,
	contactId,
	estimateId,
	invoiceId,
	onAttachAnchor,
	linkedPhotoIds,
	attaching,
	onAttach,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	dealId: string | null;
	contactId: string | null;
	estimateId?: string;
	invoiceId?: string;
	onAttachAnchor?: () => void;
	linkedPhotoIds: string[];
	attaching: boolean;
	onAttach: (photoId: string) => void;
}) {
	const trpc = useTRPC();
	const fileInput = useRef<HTMLInputElement>(null);
	const anchorless = dealId === null && contactId === null;
	const { upload, uploading } = usePhotoUpload({
		dealId: dealId ?? undefined,
		contactId: dealId ? undefined : (contactId ?? undefined),
		estimateId: anchorless ? estimateId : undefined,
		invoiceId: anchorless && !estimateId ? invoiceId : undefined,
	});

	const photos = useQuery({
		...trpc.photos.list.queryOptions(
			dealId
				? { dealId, includeDealContacts: true }
				: { contactId: contactId ?? undefined },
		),
		enabled: open && !anchorless,
	});

	const rows = photos.data?.rows ?? [];
	const linked = new Set(linkedPhotoIds);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Attach photos</DialogTitle>
					<DialogDescription>
						Choose photos from the job to include here.
					</DialogDescription>
				</DialogHeader>

				{anchorless && !estimateId && !invoiceId ? (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Icon icon={ImageIcon} />
							</EmptyMedia>
							<EmptyTitle>No job or contact attached</EmptyTitle>
							<EmptyDescription>
								{onAttachAnchor
									? "Link a job to pick from its photos, or attach one to a contact."
									: "This project has no job to attach a photo library to."}
							</EmptyDescription>
						</EmptyHeader>
						{onAttachAnchor ? (
							<EmptyContent>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										onOpenChange(false);
										onAttachAnchor();
									}}
								>
									Link a job
								</Button>
							</EmptyContent>
						) : null}
					</Empty>
				) : anchorless ? (
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
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={uploading}
								onClick={() => fileInput.current?.click()}
							>
								<Icon icon={Add} />
								Upload photos
							</Button>
							{onAttachAnchor ? (
								<Button
									type="button"
									variant="ghost"
									onClick={() => {
										onOpenChange(false);
										onAttachAnchor();
									}}
								>
									Attach a job or contact
								</Button>
							) : null}
						</div>
						<p className="text-muted-foreground text-sm">
							Uploads attach straight to this document. Attach a job or contact
							to pick from their photo library too.
						</p>
					</div>
				) : (
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

						<Button
							type="button"
							variant="outline"
							disabled={uploading}
							onClick={() => fileInput.current?.click()}
							className="self-start"
						>
							<Icon icon={Add} />
							Upload photos
						</Button>

						{photos.isPending ? (
							<div className="grid grid-cols-3 gap-3">
								{SKELETON_TILES.map((tile) => (
									<Skeleton
										key={tile}
										className="aspect-square w-full rounded-lg"
									/>
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
										Upload photos to attach them.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<div className="grid grid-cols-3 gap-3">
								{rows.map((row) => (
									<PhotoPickTile
										key={row.id}
										row={row}
										attached={linked.has(row.id)}
										attaching={attaching}
										onAttach={() => onAttach(row.id)}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function PhotoPickTile({
	row,
	attached,
	attaching,
	onAttach,
}: {
	row: PhotoRow;
	attached: boolean;
	attaching: boolean;
	onAttach: () => void;
}) {
	const url = thumbUrl(row.id);

	return (
		<button
			type="button"
			disabled={attached || attaching}
			onClick={onAttach}
			className={cn(
				"relative aspect-square w-full overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
				attached && "cursor-default",
			)}
		>
			<Image
				src={url}
				alt={row.filename}
				fill
				unoptimized={!isOptimizable(url)}
				className={cn("object-cover", attached && "opacity-50")}
			/>
			{attached ? (
				<span className="absolute inset-0 flex items-center justify-center bg-background/40">
					<Icon icon={Checkmark} className="text-primary" />
				</span>
			) : null}
			<span className="sr-only">
				{attached
					? `${row.filename} already attached`
					: `Attach ${row.filename}`}
			</span>
		</button>
	);
}
