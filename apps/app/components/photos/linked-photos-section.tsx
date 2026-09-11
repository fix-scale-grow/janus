"use client";

import Add from "@carbon/icons-react/es/Add";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { isOptimizable } from "@crm/db/images";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { ImageLightbox } from "@crm/ui/components/image-lightbox";
import { SortableItem, SortableList } from "@crm/ui/components/sortable-list";
import { Switch } from "@crm/ui/components/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { AttachPhotosDialog } from "@/components/photos/attach-photos-dialog";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

type LinkedPhoto = {
	id: string;
	photoId: string;
	includeInPdf: boolean;
	sortOrder: number;
	photo: {
		id: string;
		filename: string;
		width: number;
		height: number;
	};
};

function thumbUrl(id: string) {
	return `/api/photos/${id}/thumb`;
}

function masterUrl(id: string) {
	return `/api/photos/${id}/master`;
}

export function LinkedPhotosSection({
	surface,
	targetId,
	dealId,
}: {
	surface: "estimate" | "invoice";
	targetId: string;
	dealId: string | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const isEstimate = surface === "estimate";
	const [dialogOpen, setDialogOpen] = useState(false);
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

	const estimateLinked = useQuery({
		...trpc.photos.forEstimate.queryOptions({ estimateId: targetId }),
		enabled: isEstimate,
	});
	const invoiceLinked = useQuery({
		...trpc.photos.forInvoice.queryOptions({ invoiceId: targetId }),
		enabled: !isEstimate,
	});
	const linkedQuery = isEstimate ? estimateLinked : invoiceLinked;
	const rows: LinkedPhoto[] = linkedQuery.data ?? [];

	const settle = () =>
		Promise.all([
			cache.photos(),
			isEstimate ? cache.estimate(targetId) : cache.invoice(targetId),
		]);

	const linkEstimate = useMutation(
		trpc.photos.linkEstimate.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);
	const linkInvoice = useMutation(
		trpc.photos.linkInvoice.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const unlinkEstimate = useMutation(
		trpc.photos.unlinkEstimate.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);
	const unlinkInvoice = useMutation(
		trpc.photos.unlinkInvoice.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const setEstimatePdfFlag = useMutation(
		trpc.photos.setEstimatePdfFlag.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);
	const setInvoicePdfFlag = useMutation(
		trpc.photos.setInvoicePdfFlag.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const reorderEstimatePhotos = useMutation(
		trpc.photos.reorderEstimatePhotos.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);
	const reorderInvoicePhotos = useMutation(
		trpc.photos.reorderInvoicePhotos.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const procs = {
		attach: (photoId: string) =>
			isEstimate
				? linkEstimate.mutate({ estimateId: targetId, photoId })
				: linkInvoice.mutate({ invoiceId: targetId, photoId }),
		detach: (photoId: string) =>
			isEstimate
				? unlinkEstimate.mutate({ estimateId: targetId, photoId })
				: unlinkInvoice.mutate({ invoiceId: targetId, photoId }),
		setPdfFlag: (photoId: string, includeInPdf: boolean) =>
			isEstimate
				? setEstimatePdfFlag.mutate({
						estimateId: targetId,
						photoId,
						includeInPdf,
					})
				: setInvoicePdfFlag.mutate({
						invoiceId: targetId,
						photoId,
						includeInPdf,
					}),
		reorder: (photoIds: string[]) =>
			isEstimate
				? reorderEstimatePhotos.mutate({ estimateId: targetId, photoIds })
				: reorderInvoicePhotos.mutate({ invoiceId: targetId, photoIds }),
	};

	const photoIds = rows.map((row) => row.photoId);
	const images = rows.map((row) => ({
		src: masterUrl(row.photoId),
		title: row.photo.filename,
		width: row.photo.width,
		height: row.photo.height,
	}));

	return (
		<div className="flex flex-col gap-2">
			<h2 className="font-medium text-sm text-muted-foreground">Photos</h2>

			<Button
				type="button"
				variant="outline"
				onClick={() => setDialogOpen(true)}
				className="self-start"
			>
				<Icon icon={Add} />
				Attach photos
			</Button>

			{rows.length > 0 ? (
				<SortableList
					ids={photoIds}
					onReorder={procs.reorder}
					id={`${surface}-photos`}
				>
					<div className="flex flex-col gap-2">
						{rows.map((row, index) => (
							<SortableItem
								key={row.photoId}
								id={row.photoId}
								label={row.photo.filename}
								className="rounded-lg border bg-card p-2"
							>
								<button
									type="button"
									onClick={() => setLightboxIndex(index)}
									className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
								>
									<Image
										src={thumbUrl(row.photoId)}
										alt={row.photo.filename}
										fill
										unoptimized={!isOptimizable(thumbUrl(row.photoId))}
										className="object-cover"
									/>
									<span className="sr-only">Open {row.photo.filename}</span>
								</button>

								<span className="min-w-0 flex-1 truncate text-sm">
									{row.photo.filename}
								</span>

								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<label htmlFor={`in-pdf-${row.photoId}`}>In PDF</label>
									<Switch
										id={`in-pdf-${row.photoId}`}
										checked={row.includeInPdf}
										onCheckedChange={(checked) =>
											procs.setPdfFlag(row.photoId, checked)
										}
									/>
								</div>

								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									onClick={() => procs.detach(row.photoId)}
								>
									<Icon icon={TrashCan} />
									<span className="sr-only">Remove {row.photo.filename}</span>
								</Button>
							</SortableItem>
						))}
					</div>
				</SortableList>
			) : null}

			<AttachPhotosDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				dealId={dealId}
				linkedPhotoIds={photoIds}
				onAttach={procs.attach}
			/>

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
