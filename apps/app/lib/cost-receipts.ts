import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";

export const COST_RECEIPTS = {
	defaultDirName: join("data", "costs", "receipts"),
} as const;

export const COST_ID_PATTERN = /^[a-z0-9]{20,40}$/;

export const RECEIPT_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"application/pdf": "pdf",
};

const EXTENSION_TO_TYPE: Record<string, string> = Object.fromEntries(
	Object.entries(RECEIPT_TYPES).map(([type, ext]) => [ext, type]),
);

export function contentTypeFor(fileName: string): string {
	const ext = fileName.split(".").pop() ?? "";
	return EXTENSION_TO_TYPE[ext] ?? "application/octet-stream";
}

function dataDir(): string {
	const configured = process.env.COSTS_DATA_DIR?.trim();
	if (configured) return configured;

	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, COST_RECEIPTS.defaultDirName);
}

function receiptFile(fileName: string): string {
	return join(dataDir(), fileName);
}

export async function saveReceipt(
	costId: string,
	ext: string,
	bytes: Buffer,
): Promise<string | null> {
	try {
		const dir = dataDir();
		await mkdir(dir, { recursive: true });
		const fileName = `${costId}.${ext}`;
		await writeFile(receiptFile(fileName), bytes);
		return fileName;
	} catch {
		return null;
	}
}

export async function readReceipt(fileName: string): Promise<Buffer | null> {
	try {
		return await readFile(receiptFile(fileName));
	} catch {
		return null;
	}
}

export async function removeReceipt(fileName: string): Promise<void> {
	try {
		await unlink(receiptFile(fileName));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}
