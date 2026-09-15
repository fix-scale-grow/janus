import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

const SRC = join(import.meta.dir, "..", "src");

const PUBLIC_PROCEDURES = new Set([
	"contracts/contract-signing.router.ts:bySigningToken",
	"contracts/contract-signing.router.ts:sign",
	"proposals/proposal-view.router.ts:byToken",
	"proposals/proposal-view.router.ts:accept",
	"proposals/proposal-view.router.ts:recordView",
	"proposals/proposal-view.router.ts:decline",
	"sso/sso.router.ts:signInOptions",
]);

type Found = { file: string; name: string; tagged: boolean };

const PROCEDURE_PATTERN =
	/@(Query|Mutation)\(([\s\S]*?)\)\s*(?:@\w+\([^)]*\)\s*)*(?:async\s+)?(\w+)/g;

const DECORATOR_COUNT_PATTERN = /@(?:Query|Mutation)\(/g;

const USE_MIDDLEWARES_PATTERN = /@UseMiddlewares\(([^)]*)\)/g;

function procedures(file: string, source: string): Found[] {
	const out: Found[] = [];
	for (const match of source.matchAll(PROCEDURE_PATTERN)) {
		out.push({
			file,
			name: match[3] as string,
			tagged: /meta\s*:/.test(match[2] as string),
		});
	}
	return out;
}

function decoratorCount(source: string): number {
	return [...source.matchAll(DECORATOR_COUNT_PATTERN)].length;
}

function middlewareCallArgs(source: string): string[] {
	return [...source.matchAll(USE_MIDDLEWARES_PATTERN)].map(
		(match) => match[1] as string,
	);
}

describe("access tags", () => {
	const files = [...new Glob("**/*.router.ts").scanSync(SRC)];

	test("finds the routers", () => {
		expect(files.length).toBeGreaterThanOrEqual(38);
	});

	test("the procedure regex misses no @Query/@Mutation decorator", () => {
		const mismatched: string[] = [];
		for (const file of files) {
			const normalized = file.replaceAll("\\", "/");
			const source = readFileSync(join(SRC, file), "utf8");
			const matched = procedures(normalized, source).length;
			const decorators = decoratorCount(source);
			if (matched !== decorators) {
				mismatched.push(
					`${normalized}: matched ${matched}, decorators ${decorators}`,
				);
			}
		}
		expect(mismatched).toEqual([]);
	});

	test("every non-public procedure has an access tag", () => {
		const untagged: string[] = [];
		for (const file of files) {
			const normalized = file.replaceAll("\\", "/");
			for (const proc of procedures(
				normalized,
				readFileSync(join(SRC, file), "utf8"),
			)) {
				const isPublic = PUBLIC_PROCEDURES.has(`${normalized}:${proc.name}`);
				if (!isPublic && !proc.tagged)
					untagged.push(`${normalized}:${proc.name}`);
			}
		}
		expect(untagged).toEqual([]);
	});

	test("every @UseMiddlewares call with AuthMiddleware also carries AccessMiddleware", () => {
		const missing: string[] = [];
		for (const file of files) {
			const normalized = file.replaceAll("\\", "/");
			const source = readFileSync(join(SRC, file), "utf8");
			for (const args of middlewareCallArgs(source)) {
				if (
					args.includes("AuthMiddleware") &&
					!args.includes("AccessMiddleware")
				) {
					missing.push(`${normalized}: @UseMiddlewares(${args.trim()})`);
				}
			}
		}
		expect(missing).toEqual([]);
	});
});
