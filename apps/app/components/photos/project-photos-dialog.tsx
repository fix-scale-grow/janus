"use client";

import Add from "@carbon/icons-react/es/Add";
import ImageIcon from "@carbon/icons-react/es/Image";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import { isOptimizable } from "@crm/db/images";
import { Badge } from "@crm/ui/components/badge";
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
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@crm/ui/components/empty";
import { Icon } from "@crm/ui/components/icon";
import { ImageLightbox } from "@crm/ui/components/image-lightbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Skeleton } from "@crm/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { AttachPhotosDialog } from "@/components/photos/attach-photos-dialog";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useSubmitGuard } from "@/lib/use-submit-guard";

type ProjectPhoto = RouterOutputs["photos"]["forProject"][number];
type StageLabel = ProjectPhoto["stageLabel"];

const STAGE_LABELS = {
	BEFORE: "Before",
	IN_PROGRESS: "In progress",
	AFTER: "After",
	FINAL: "Final",
} as const;

const STAGE_ORDER: StageLabel[] = ["BEFORE", "IN_PROGRESS", "AFTER", "FINAL"];

const STAGE_BADGE_VARIANT: Record<
	StageLabel,
	"outline" | "secondary" | "default"
> = {
	BEFORE: "outline",
	IN_PROGRESS: "secondary",
	AFTER: "secondary",
	FINAL: "default",
};

const SKELETON_TILES = ["one", "two", "three", "four", "five", "six"];

function thumbUrl(id: string) {
	return `/api/photos/${id}/thumb`;
}

function masterUrl(id: string) {
	return `/api/photos/${id}/master`;
}

export function ProjectPhotosDialog({
	open,
	onOpenChange,
	projectId,
	dealId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	dealId: string | null;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [attachOpen, setAttachOpen] = useState(false);
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
	const attachGuard = useSubmitGuard();
	const detachGuard = useSubmitGuard();
	const stageGuard = useSubmitGuard();

	const photosQuery = useQuery({
		...trpc.photos.forProject.queryOptions({ projectId }),
		enabled: open,
	});
	const rows: ProjectPhoto[] = photosQuery.data ?? [];

	const settle = () => Promise.all([cache.photos(), cache.project(projectId)]);

	const linkProject = useMutation(
		trpc.photos.linkProject.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
			onSettled: () => attachGuard.release(),
		}),
	);

	const unlinkProject = useMutation(
		trpc.photos.unlinkProject.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
			onSettled: () => detachGuard.release(),
		}),
	);

	const setStage = useMutation(
		trpc.photos.setProjectStage.mutationOptions({
			onSuccess: () => settle(),
			onError: (error) => toast.error(error.message),
			onSettled: () => stageGuard.release(),
		}),
	);

	const procs = {
		attach: (photoId: string) =>
			attachGuard.guard(() => linkProject.mutate({ projectId, photoId })),
		detach: (photoId: string) =>
			detachGuard.guard(() => unlinkProject.mutate({ projectId, photoId })),
		setStage: (photoId: string, stageLabel: StageLabel) =>
			stageGuard.guard(() =>
				setStage.mutate({ projectId, photoId, stageLabel }),
			),
	};

	const photoIds = rows.map((row) => row.photoId);
	const images = rows.map((row) => ({
		src: masterUrl(row.photoId),
		title: row.photo.filename,
		width: row.photo.width,
		height: row.photo.height,
	}));

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent size="fullscreen">
					<DialogHeader>
						<DialogTitle>Photos</DialogTitle>
						<DialogDescription>
							Attach photos from the job and mark their stage.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-4 overflow-y-auto">
						<Button
							type="button"
							variant="outline"
							onClick={() => setAttachOpen(true)}
							className="self-start"
						>
							<Icon icon={Add} />
							Attach photos
						</Button>

						{photosQuery.isPending ? (
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
										Attach photos from the job to show progress here.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
								{rows.map((row, index) => (
									<ProjectPhotoTile
										key={row.photoId}
										row={row}
										removing={unlinkProject.isPending}
										onOpen={() => setLightboxIndex(index)}
										onRemove={() => procs.detach(row.photoId)}
										onStageChange={(stageLabel) =>
											procs.setStage(row.photoId, stageLabel)
										}
									/>
								))}
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<AttachPhotosDialog
				open={attachOpen}
				onOpenChange={setAttachOpen}
				dealId={dealId}
				linkedPhotoIds={photoIds}
				attaching={linkProject.isPending}
				onAttach={procs.attach}
			/>

			<ImageLightbox
				open={lightboxIndex !== null}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) setLightboxIndex(null);
				}}
				images={images}
				index={lightboxIndex ?? 0}
				onIndexChange={setLightboxIndex}
			/>
		</>
	);
}

function ProjectPhotoTile({
	row,
	removing,
	onOpen,
	onRemove,
	onStageChange,
}: {
	row: ProjectPhoto;
	removing: boolean;
	onOpen: () => void;
	onRemove: () => void;
	onStageChange: (stageLabel: StageLabel) => void;
}) {
	const url = thumbUrl(row.photoId);

	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-card p-2">
			<button
				type="button"
				onClick={onOpen}
				className="relative aspect-square w-full overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<Image
					src={url}
					alt={row.photo.filename}
					fill
					unoptimized={!isOptimizable(url)}
					className="object-cover"
				/>
				<Badge
					variant={STAGE_BADGE_VARIANT[row.stageLabel]}
					className="absolute top-2 left-2"
				>
					{STAGE_LABELS[row.stageLabel]}
				</Badge>
				<span className="sr-only">Open {row.photo.filename}</span>
			</button>

			<div className="flex items-center gap-2">
				<Select
					value={row.stageLabel}
					onValueChange={(value) => onStageChange(value as StageLabel)}
				>
					<SelectTrigger size="sm" className="flex-1">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{STAGE_ORDER.map((stage) => (
							<SelectItem key={stage} value={stage}>
								{STAGE_LABELS[stage]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					disabled={removing}
					onClick={onRemove}
				>
					<Icon icon={TrashCan} />
					<span className="sr-only">Remove {row.photo.filename}</span>
				</Button>
			</div>
		</div>
	);
}
