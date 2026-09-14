import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";

const DOCUMENT_DIR_NAME = join("data", "permits", "documents");

function documentsDir(): string {
	const configured = process.env.PERMITS_DATA_DIR?.trim();
	if (configured) return join(configured, "documents");

	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, DOCUMENT_DIR_NAME);
}

export async function savePermitDocumentFile(
	documentId: string,
	ext: string,
	bytes: Buffer,
): Promise<string | null> {
	try {
		const dir = documentsDir();
		await mkdir(dir, { recursive: true });
		const fileName = `${documentId}.${ext}`;
		await writeFile(join(dir, fileName), bytes);
		return fileName;
	} catch {
		return null;
	}
}
