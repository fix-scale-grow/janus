import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";
import { COST_ID_PATTERN } from "@/lib/cost-receipts";

export const PERMIT_FILES = {
	lockerDirName: join("data", "permits", "locker"),
	documentDirName: join("data", "permits", "documents"),
} as const;

export { COST_ID_PATTERN };

export const PERMIT_FILE_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"application/pdf": "pdf",
};

const EXTENSION_TO_TYPE: Record<string, string> = Object.fromEntries(
	Object.entries(PERMIT_FILE_TYPES).map(([type, ext]) => [ext, type]),
);

export function contentTypeFor(fileName: string): string {
	const ext = fileName.split(".").pop() ?? "";
	return EXTENSION_TO_TYPE[ext] ?? "application/octet-stream";
}

type PermitFileArea = "locker" | "documents";

function dataDir(area: PermitFileArea): string {
	const configured = process.env.PERMITS_DATA_DIR?.trim();
	if (configured) return join(configured, area);

	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	const dirName =
		area === "locker"
			? PERMIT_FILES.lockerDirName
			: PERMIT_FILES.documentDirName;
	return join(root, dirName);
}

function filePathFor(area: PermitFileArea, fileName: string): string {
	return join(dataDir(area), fileName);
}

async function saveFile(
	area: PermitFileArea,
	id: string,
	ext: string,
	bytes: Buffer,
): Promise<string | null> {
	try {
		const dir = dataDir(area);
		await mkdir(dir, { recursive: true });
		const fileName = `${id}.${ext}`;
		await writeFile(filePathFor(area, fileName), bytes);
		return fileName;
	} catch {
		return null;
	}
}

async function readFileFrom(
	area: PermitFileArea,
	fileName: string,
): Promise<Buffer | null> {
	try {
		return await readFile(filePathFor(area, fileName));
	} catch {
		return null;
	}
}

async function removeFileFrom(
	area: PermitFileArea,
	fileName: string,
): Promise<void> {
	try {
		await unlink(filePathFor(area, fileName));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

export async function saveLockerFile(
	id: string,
	ext: string,
	bytes: Buffer,
): Promise<string | null> {
	return saveFile("locker", id, ext, bytes);
}

export async function readLockerFile(fileName: string): Promise<Buffer | null> {
	return readFileFrom("locker", fileName);
}

export async function removeLockerFile(fileName: string): Promise<void> {
	return removeFileFrom("locker", fileName);
}

export async function savePermitFile(
	id: string,
	ext: string,
	bytes: Buffer,
): Promise<string | null> {
	return saveFile("documents", id, ext, bytes);
}

export async function readPermitFile(fileName: string): Promise<Buffer | null> {
	return readFileFrom("documents", fileName);
}

export async function removePermitFile(fileName: string): Promise<void> {
	return removeFileFrom("documents", fileName);
}
