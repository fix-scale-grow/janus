import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const SRC = join(import.meta.dir, "..", "src");
const SKIP_DIR_NAMES = new Set(["node_modules", "generated", "test"]);
const SOURCE_EXTENSIONS = new Set([".ts"]);

const SENTENCE_EM_DASH = /[A-Za-z)]\s?—\s?[A-Za-z(]/;
const LOGGER_CALL = /\blogger\.(log|warn|error|debug)\s*\(/;

const NOT_USER_VISIBLE_FILES = new Set([
	"config/env.validation.ts",
	"backfill/backfill.service.ts",
]);

type Violation = { file: string; line: number; text: string };

function isTestFile(name: string): boolean {
	return /\.(test|spec)\.ts$/.test(name);
}

function isCommentLine(line: string): boolean {
	const trimmed = line.trim();
	return (
		trimmed.startsWith("//") ||
		trimmed.startsWith("*") ||
		trimmed.startsWith("/*")
	);
}

function walk(dir: string, out: string[]): void {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIR_NAMES.has(entry)) continue;
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			walk(full, out);
			continue;
		}
		if (!SOURCE_EXTENSIONS.has(extname(entry))) continue;
		if (isTestFile(entry)) continue;
		out.push(full);
	}
}

function scan(file: string, relative: string, violations: Violation[]): void {
	if (NOT_USER_VISIBLE_FILES.has(relative)) return;
	const lines = readFileSync(file, "utf8").split("\n");
	lines.forEach((line, index) => {
		if (!line.includes("—")) return;
		if (isCommentLine(line)) return;
		const windowStart = Math.max(0, index - 6);
		const window = lines.slice(windowStart, index + 1).join("\n");
		if (LOGGER_CALL.test(window)) return;
		if (SENTENCE_EM_DASH.test(line)) {
			violations.push({ file: relative, line: index + 1, text: line.trim() });
		}
	});
}

describe("no em dash in user-visible API copy", () => {
	test("no source file under src uses an em dash between words in a message a user reads", () => {
		const files: string[] = [];
		walk(SRC, files);

		const violations: Violation[] = [];
		for (const file of files) {
			const relative = file.slice(SRC.length + 1).replace(/\\/g, "/");
			scan(file, relative, violations);
		}

		if (violations.length > 0) {
			const report = violations
				.map((v) => `${v.file}:${v.line}: ${v.text}`)
				.join("\n");
			throw new Error(
				`Found em dash in API copy (exceptions, template/email text, seed/demo text). Rewrite with a period, comma or colon:\n${report}`,
			);
		}

		expect(violations).toHaveLength(0);
	});
});
