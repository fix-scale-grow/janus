import { DrawingBackground } from "@crm/db";
import { drawingScale, drawingScene } from "@crm/drawings";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

const backgroundEnum = z.enum(
	Object.values(DrawingBackground) as [
		DrawingBackground,
		...DrawingBackground[],
	],
);

export const drawingListInput = listInput.extend({
	attachment: z.enum(["all", "deal", "contact", "unattached"]).default("all"),
	dealId: z.string().optional(),
	contactId: z.string().optional(),
});

export type DrawingListInput = z.infer<typeof drawingListInput>;

export const drawingIdInput = z.object({ id: z.string().min(1) });

export type DrawingIdInput = z.infer<typeof drawingIdInput>;

export const drawingCreateInput = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	background: backgroundEnum.default("WHITEBOARD"),
	dealId: z.string().optional(),
	contactId: z.string().optional(),
	address: z.string().trim().max(500).optional(),
});

export type DrawingCreateInput = z.infer<typeof drawingCreateInput>;

export const drawingSaveSceneInput = z.object({
	id: z.string().min(1),
	scene: drawingScene,
	scale: drawingScale.nullish(),
});

export type DrawingSaveSceneInput = z.infer<typeof drawingSaveSceneInput>;

export const drawingRenameInput = z.object({
	id: z.string().min(1),
	title: z.string().trim().min(1, "A drawing needs a name.").max(200),
});

export type DrawingRenameInput = z.infer<typeof drawingRenameInput>;

export const drawingAttachInput = z.object({
	id: z.string().min(1),
	dealId: z.string().nullable().optional(),
	contactId: z.string().nullable().optional(),
});

export type DrawingAttachInput = z.infer<typeof drawingAttachInput>;

export const drawingRestoreVersionInput = z.object({
	id: z.string().min(1),
	versionId: z.string().min(1),
});

export type DrawingRestoreVersionInput = z.infer<
	typeof drawingRestoreVersionInput
>;

export const drawingSetThumbnailInput = z.object({
	id: z.string().min(1),
	thumbnailUrl: z.string().url(),
});

export type DrawingSetThumbnailInput = z.infer<typeof drawingSetThumbnailInput>;
