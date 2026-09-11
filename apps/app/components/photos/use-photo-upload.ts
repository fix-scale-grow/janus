"use client";

import { useState } from "react";
import { toast } from "sonner";
import { processPhotoFile } from "@/lib/photo-client";
import { useCrmCache } from "@/lib/trpc/cache";

type UsePhotoUploadInput = {
	dealId?: string;
	contactId?: string;
};

type UploadResult = {
	upload: (files: File[]) => Promise<void>;
	uploading: boolean;
};

export function usePhotoUpload({
	dealId,
	contactId,
}: UsePhotoUploadInput): UploadResult {
	const cache = useCrmCache();
	const [pending, setPending] = useState(0);

	const upload = async (files: File[]) => {
		setPending((count) => count + 1);
		try {
			for (const file of files) {
				const processed = await processPhotoFile(file);
				if (!processed) {
					toast.error(`${file.name} isn't a supported image — use JPEG.`);
					continue;
				}

				const body = new FormData();
				body.set("master", processed.master);
				body.set("thumb", processed.thumb);
				if (dealId) body.set("dealId", dealId);
				if (contactId) body.set("contactId", contactId);
				body.set("filename", file.name);
				body.set("width", String(processed.width));
				body.set("height", String(processed.height));
				body.set("takenAt", String(file.lastModified));

				const response = await fetch("/api/photos/upload", {
					method: "POST",
					body,
				});

				if (!response.ok) {
					const data = await response.json().catch(() => null);
					toast.error(data?.error ?? `${file.name} could not be uploaded.`);
				}
			}

			await cache.photos();
		} finally {
			setPending((count) => count - 1);
		}
	};

	return { upload, uploading: pending > 0 };
}
