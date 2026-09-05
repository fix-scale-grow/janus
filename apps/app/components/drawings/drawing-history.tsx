"use client";

import HistoryIcon from "@carbon/icons-react/es/History";
import Restart from "@carbon/icons-react/es/Restart";
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
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LocalDateTime, LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Version = RouterOutputs["drawings"]["versions"][number];

export function DrawingHistory({
	drawingId,
	onRestored,
}: {
	drawingId: string;
	onRestored: () => void;
}) {
	const trpc = useTRPC();
	const [open, setOpen] = useState(false);
	const [restoring, setRestoring] = useState<Version | null>(null);

	const versions = useQuery({
		...trpc.drawings.versions.queryOptions({ id: drawingId }),
		enabled: open,
	});

	return (
		<>
			<Button onClick={() => setOpen(true)} variant="outline">
				<Icon icon={HistoryIcon} data-icon="inline-start" />
				History
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Version history</DialogTitle>
						<DialogDescription>
							Restore an earlier save of this drawing.
						</DialogDescription>
					</DialogHeader>

					{versions.isPending && (
						<div className="flex items-center justify-center p-6">
							<Spinner />
						</div>
					)}

					{versions.isError && (
						<p className="text-destructive text-sm">{versions.error.message}</p>
					)}

					{versions.data && versions.data.length === 0 && (
						<p className="text-muted-foreground text-sm">
							No saved versions yet.
						</p>
					)}

					{versions.data && versions.data.length > 0 && (
						<div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
							{versions.data.map((version) => (
								<div
									className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
									key={version.id}
								>
									<div className="flex flex-col">
										<span className="text-sm">
											<LocalRelativeTime date={version.createdAt} />
										</span>
										<span className="text-muted-foreground text-xs">
											<LocalDateTime
												date={version.createdAt}
												options={{
													dateStyle: "medium",
													timeStyle: "short",
												}}
											/>
										</span>
									</div>
									<Button
										onClick={() => setRestoring(version)}
										size="sm"
										variant="outline"
									>
										<Icon icon={Restart} data-icon="inline-start" />
										Restore
									</Button>
								</div>
							))}
						</div>
					)}
				</DialogContent>
			</Dialog>

			<RestoreVersionDialog
				drawingId={drawingId}
				onOpenChange={(next) => {
					if (!next) setRestoring(null);
				}}
				onRestored={() => {
					setRestoring(null);
					setOpen(false);
					onRestored();
				}}
				version={restoring}
			/>
		</>
	);
}

function RestoreVersionDialog({
	drawingId,
	version,
	onOpenChange,
	onRestored,
}: {
	drawingId: string;
	version: Version | null;
	onOpenChange: (open: boolean) => void;
	onRestored: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const restore = useMutation(
		trpc.drawings.restoreVersion.mutationOptions({
			onSuccess: async () => {
				await cache.drawing(drawingId);
				onRestored();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<AlertDialog open={version !== null} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Restore this version?</AlertDialogTitle>
					<AlertDialogDescription>
						The current scene is replaced. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={restore.isPending}
						onClick={() => {
							if (!version) return;
							restore.mutate({ id: drawingId, versionId: version.id });
						}}
					>
						{restore.isPending ? <Spinner /> : null}
						Restore
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
