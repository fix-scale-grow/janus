import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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

export async function saveLogo(
	ext: string,
	bytes: Buffer,
): Promise<string | null> {
	try {
		const dir = dataDir();
		await mkdir(dir, { recursive: true });
		await removeLogo();
		await writeFile(logoFile(ext), bytes);
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
