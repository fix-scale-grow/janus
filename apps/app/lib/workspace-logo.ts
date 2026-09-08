import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";

export const WORKSPACE_LOGO = {
	defaultDirName: join("data", "workspace"),
} as const;

export const LOGO_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/svg+xml": "svg",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

const LOGO_EXTENSIONS = Object.values(LOGO_TYPES);

const EXTENSION_TO_TYPE: Record<string, string> = Object.fromEntries(
	Object.entries(LOGO_TYPES).map(([type, ext]) => [ext, type]),
);

function dataDir(): string {
	const configured = process.env.WORKSPACE_DATA_DIR?.trim();
	if (configured) return configured;

	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, WORKSPACE_LOGO.defaultDirName);
}

function logoFile(ext: string): string {
	return join(dataDir(), `logo.${ext}`);
}

const MAGIC_BYTE_CHECKS: Record<string, (bytes: Buffer) => boolean> = {
	"image/png": (bytes) =>
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a,
	"image/jpeg": (bytes) =>
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff,
	"image/webp": (bytes) =>
		bytes.length >= 12 &&
		bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
		bytes.subarray(8, 12).toString("ascii") === "WEBP",
	"image/svg+xml": (bytes) => {
		const head = bytes
			.subarray(0, 512)
			.toString("utf8")
			.replace(/^﻿/, "")
			.trimStart();
		return /^(<\?xml|<svg)/i.test(head);
	},
};

export function matchesDeclaredType(mimeType: string, bytes: Buffer): boolean {
	const check = MAGIC_BYTE_CHECKS[mimeType];
	return check ? check(bytes) : false;
}

const SVG_UNSAFE_PATTERNS = [
	/<script[\s>]/i,
	/<foreignobject[\s>]/i,
	/\son\w+\s*=/i,
	/(?:xlink:href|href)\s*=\s*["']\s*javascript:/i,
	/(?:xlink:href|href)\s*=\s*["']\s*(?:https?:)?\/\//i,
	/(?:xlink:href|href)\s*=\s*["'][^"']*&#/i,
];

export function isSvgSafe(bytes: Buffer): boolean {
	const text = bytes.toString("utf8");
	return !SVG_UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}

export async function saveLogo(
	ext: string,
	bytes: Buffer,
): Promise<string | null> {
	try {
		const dir = dataDir();
		await mkdir(dir, { recursive: true });
		await removeLogo();
		const target = logoFile(ext);
		const tempFile = join(dir, `.${randomBytes(8).toString("hex")}.tmp`);
		await writeFile(tempFile, bytes);
		await rename(tempFile, target);
		return `/api/workspace/logo/file?v=${Date.now()}`;
	} catch {
		return null;
	}
}

export async function readLogo(): Promise<{
	bytes: Buffer;
	contentType: string;
} | null> {
	for (const ext of LOGO_EXTENSIONS) {
		try {
			const bytes = await readFile(logoFile(ext));
			return {
				bytes,
				contentType: EXTENSION_TO_TYPE[ext] ?? "application/octet-stream",
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	return null;
}

export async function removeLogo(): Promise<void> {
	await Promise.all(
		LOGO_EXTENSIONS.map(async (ext) => {
			try {
				await unlink(logoFile(ext));
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
		}),
	);
}
