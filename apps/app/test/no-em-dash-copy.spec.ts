import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIR_NAMES = new Set(["node_modules", ".next", "test"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const SENTENCE_EM_DASH = /[A-Za-z)]\s?—\s?[A-Za-z(]/;

type Violation = { file: string; line: number; text: string };

function isTestFile(name: string): boolean {
	return /\.(test|spec)\.tsx?$/.test(name);
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

function scan(file: string, violations: Violation[]): void {
	const lines = readFileSync(file, "utf8").split("\n");
	lines.forEach((line, index) => {
		if (!line.includes("—")) return;
		if (isCommentLine(line)) return;
		if (SENTENCE_EM_DASH.test(line)) {
			violations.push({ file, line: index + 1, text: line.trim() });
		}
	});
}

describe("no em dash in user-visible copy", () => {
	test("no source file under app, components or lib uses an em dash between words", () => {
		const files: string[] = [];
		for (const dir of SCAN_DIRS) {
			walk(join(ROOT, dir), files);
		}

		const violations: Violation[] = [];
		for (const file of files) {
			scan(file, violations);
		}

		if (violations.length > 0) {
			const report = violations
				.map((v) => `${v.file}:${v.line}: ${v.text}`)
				.join("\n");
			throw new Error(
				`Found em dash in copy (Kyle bans em dashes in UI text). Rewrite with a period, comma or colon:\n${report}`,
			);
		}

		expect(violations).toHaveLength(0);
	});
});
