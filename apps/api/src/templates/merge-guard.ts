import { BadRequestException } from "@nestjs/common";
import { MERGE_TOKEN_PATTERN } from "./render-email";
import type { TemplateBlocks } from "./template-blocks";

export type MissingMerge = {
	token: string;
	label: string;
	reason: "empty" | "unknown";
};

const EXEMPT_TOKENS = new Set(["personal_note"]);

function scanTokens(text: string, tokens: Set<string>): void {
	for (const match of text.matchAll(MERGE_TOKEN_PATTERN)) {
		const token = match[1];
		if (token) tokens.add(token);
	}
}

export function collectTokens(
	subject: string,
	blocks: TemplateBlocks,
): string[] {
	const tokens = new Set<string>();

	scanTokens(subject, tokens);

	for (const block of blocks) {
		switch (block.kind) {
			case "heading":
				scanTokens(block.text, tokens);
				break;
			case "text":
				scanTokens(block.html, tokens);
				break;
			case "button":
				scanTokens(block.label, tokens);
				break;
			case "divider":
			case "spacer":
			case "logo":
				break;
		}
	}

	return [...tokens];
}

export function missingMerges(
	tokens: string[],
	context: Record<string, string>,
	registry: Map<string, string>,
): MissingMerge[] {
	const missing: MissingMerge[] = [];

	for (const token of tokens) {
		if (EXEMPT_TOKENS.has(token)) continue;

		const label = registry.get(token);
		if (label === undefined) {
			missing.push({ token, label: token, reason: "unknown" });
			continue;
		}

		const value = context[token];
		if (value === undefined || value === "") {
			missing.push({ token, label, reason: "empty" });
		}
	}

	return missing;
}

export function assertMergeComplete(
	entity: string,
	missing: MissingMerge[],
): void {
	const unknownLabels = missing
		.filter((entry) => entry.reason === "unknown")
		.map((entry) => entry.label);

	if (unknownLabels.length > 0) {
		throw new BadRequestException(
			`No longer exists — remove from the template: ${unknownLabels.join(", ")}`,
		);
	}

	const emptyLabels = missing
		.filter((entry) => entry.reason === "empty")
		.map((entry) => entry.label);

	if (emptyLabels.length > 0) {
		throw new BadRequestException(
			`Missing for this ${entity}: ${emptyLabels.join(", ")}`,
		);
	}
}
