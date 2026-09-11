import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";

export const PHOTO_ID_PATTERN = /^[a-z0-9]{20,40}$/;
export const PHOTO_VARIANTS = ["master", "thumb"] as const;
export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_THUMB_MAX_BYTES = 1024 * 1024;

const DEFAULT_DIR_NAME = join("data", "photos");

function dataDir(): string {
	const override = process.env.PHOTOS_DATA_DIR?.trim();
	if (override) return override;
	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, DEFAULT_DIR_NAME);
}

function photoDir(photoId: string): string {
	return join(dataDir(), photoId);
}

async function writeAtomic(dir: string, name: string, bytes: Buffer) {
	const temp = join(dir, `.${randomBytes(8).toString("hex")}.tmp`);
	await writeFile(temp, bytes);
	await rename(temp, join(dir, name));
}

export async function savePhotoFiles(
	photoId: string,
	master: Buffer,
	thumb: Buffer,
): Promise<boolean> {
	try {
		const dir = photoDir(photoId);
		await mkdir(dir, { recursive: true });
		await writeAtomic(dir, "master.jpg", master);
		await writeAtomic(dir, "thumb.jpg", thumb);
		return true;
	} catch {
		return false;
	}
}

export async function readPhotoFile(
	photoId: string,
	variant: PhotoVariant,
): Promise<Buffer | null> {
	try {
		return await readFile(join(photoDir(photoId), `${variant}.jpg`));
	} catch {
		return null;
	}
}

export async function removePhotoFiles(photoId: string): Promise<void> {
	try {
		await rm(photoDir(photoId), { recursive: true, force: true });
	} catch {}
}

export function photoUrl(photoId: string, variant: PhotoVariant): string {
	return `/api/photos/${photoId}/${variant}`;
}
