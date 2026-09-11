"use client";

import ChevronLeft from "@carbon/icons-react/es/ChevronLeft";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { isOptimizable } from "@crm/db/images";
import { Button } from "@crm/ui/components/button";
import { Dialog, DialogContent, DialogTitle } from "@crm/ui/components/dialog";
import { Icon } from "@crm/ui/components/icon";
import Image from "next/image";
import { useEffect } from "react";

export type ImageLightboxImage = {
	src: string;
	title: string;
	width: number;
	height: number;
};

export function ImageLightbox({
	open,
	onOpenChange,
	images,
	index,
	onIndexChange,
	size = "fullscreen",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	images: ImageLightboxImage[];
	index: number;
	onIndexChange: (index: number) => void;
	size?: "fullscreen";
}) {
	const image = images[index];
	const hasPrev = index > 0;
	const hasNext = index < images.length - 1;

	useEffect(() => {
		if (!open) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "ArrowLeft" && hasPrev) onIndexChange(index - 1);
			if (event.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, hasPrev, hasNext, index, onIndexChange]);

	if (!image) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				size={size}
				className="flex flex-col items-stretch gap-0 bg-background/95 p-0"
			>
				<DialogTitle className="sr-only">{image.title}</DialogTitle>

				<div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
					{hasPrev ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-lg"
							className="absolute left-2 z-10"
							onClick={() => onIndexChange(index - 1)}
						>
							<Icon icon={ChevronLeft} />
							<span className="sr-only">Previous</span>
						</Button>
					) : null}

					<Image
						src={image.src}
						alt={image.title}
						width={image.width}
						height={image.height}
						unoptimized={!isOptimizable(image.src)}
						className="h-auto max-h-[calc(100vh-8rem)] w-auto max-w-[calc(100vw-8rem)] object-contain"
					/>

					{hasNext ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-lg"
							className="absolute right-2 z-10"
							onClick={() => onIndexChange(index + 1)}
						>
							<Icon icon={ChevronRight} />
							<span className="sr-only">Next</span>
						</Button>
					) : null}
				</div>

				<div className="shrink-0 py-3 text-center text-muted-foreground text-xs">
					{image.title}
				</div>
			</DialogContent>
		</Dialog>
	);
}
