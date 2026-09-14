import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot } from "@crm/env";

const PDF_LOGO_FILES: { file: string; mime: string }[] = [
	{ file: "logo.png", mime: "image/png" },
	{ file: "logo.jpg", mime: "image/jpeg" },
];

function dataDir(): string {
	const configured = process.env.WORKSPACE_DATA_DIR?.trim();
	if (configured) return configured;
	const root = findWorkspaceRoot(process.cwd()) ?? process.cwd();
	return join(root, "data", "workspace");
}

export async function readLogoDataUrl(): Promise<string | null> {
	const dir = dataDir();
	for (const { file, mime } of PDF_LOGO_FILES) {
		try {
			const bytes = await readFile(join(dir, file));
			return `data:${mime};base64,${bytes.toString("base64")}`;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	return null;
}
