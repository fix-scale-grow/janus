import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";

export const DRAWING_THUMBNAILS = {
	defaultDirName: join("data", "drawings", "thumbnails"),
} as const;

function dataDir(): string {
	const configured = process.env.DRAWINGS_DATA_DIR?.trim();
	if (configured) return configured;

	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, DRAWING_THUMBNAILS.defaultDirName);
}

function thumbnailPath(drawingId: string): string {
	return join(dataDir(), `${drawingId}.png`);
}

export async function saveThumbnail(
	drawingId: string,
	bytes: Buffer,
): Promise<string | null> {
	try {
		const dir = dataDir();
		await mkdir(dir, { recursive: true });
		await writeFile(thumbnailPath(drawingId), bytes);
		return `/api/drawings/thumbnail/${drawingId}?v=${Date.now()}`;
	} catch {
		return null;
	}
}

export async function readThumbnail(drawingId: string): Promise<Buffer | null> {
	try {
		return await readFile(thumbnailPath(drawingId));
	} catch {
		return null;
	}
}
