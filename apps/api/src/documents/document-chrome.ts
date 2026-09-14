import type { Db } from "@crm/db";
import {
	readDocumentChromeRaw,
	writeDocumentChromeRaw,
} from "@crm/db/settings";
import { z } from "zod";
import { templateBlockSchema } from "../templates/template-blocks";

const chromeBlocksSchema = z.array(templateBlockSchema).max(8);

export const documentChromeSchema = z.object({
	headerBlocks: chromeBlocksSchema,
	footerBlocks: chromeBlocksSchema,
});

export type DocumentChrome = z.infer<typeof documentChromeSchema>;

export const DEFAULT_DOCUMENT_CHROME: DocumentChrome = {
	headerBlocks: [{ kind: "heading", text: "{{business.name}}" }],
	footerBlocks: [{ kind: "text", html: "{{business.name}}" }],
};

export async function readDocumentChrome(db: Db): Promise<DocumentChrome> {
	const raw = await readDocumentChromeRaw(db);

	const parsed = documentChromeSchema.safeParse(raw.documentChrome);
	if (parsed.success) return parsed.data;

	const headerBlocks = [...DEFAULT_DOCUMENT_CHROME.headerBlocks];
	if (raw.legacyHeaderText) {
		headerBlocks.push({ kind: "text", html: raw.legacyHeaderText });
	}
	const footerBlocks = raw.legacyFooterText
		? [{ kind: "text" as const, html: raw.legacyFooterText }]
		: [...DEFAULT_DOCUMENT_CHROME.footerBlocks];

	return { headerBlocks, footerBlocks };
}

export async function writeDocumentChrome(
	db: Db,
	chrome: DocumentChrome,
): Promise<void> {
	await writeDocumentChromeRaw(db, documentChromeSchema.parse(chrome));
}
