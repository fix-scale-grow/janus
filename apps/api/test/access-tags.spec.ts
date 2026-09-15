import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

const SRC = join(import.meta.dir, "..", "src");

const PUBLIC_PROCEDURES = new Set([
	"contracts/contract-signing.router.ts:bySigningToken",
	"contracts/contract-signing.router.ts:sign",
	"proposals/proposal-view.router.ts:*",
	"sso/sso.router.ts:signInOptions",
]);

type Found = { file: string; name: string; tagged: boolean };

function procedures(file: string, source: string): Found[] {
	const out: Found[] = [];
	const pattern =
		/@(Query|Mutation)\(([\s\S]*?)\)\s*(?:@\w+\([^)]*\)\s*)*(?:async\s+)?(\w+)/g;
	for (const match of source.matchAll(pattern)) {
		out.push({
			file,
			name: match[3] as string,
			tagged: /meta\s*:/.test(match[2] as string),
		});
	}
	return out;
}

describe("access tags", () => {
	const files = [...new Glob("**/*.router.ts").scanSync(SRC)];

	test("finds the routers", () => {
		expect(files.length).toBeGreaterThanOrEqual(38);
	});

	test("every non-public procedure has an access tag", () => {
		const untagged: string[] = [];
		for (const file of files) {
			const normalized = file.replaceAll("\\", "/");
			for (const proc of procedures(
				normalized,
				readFileSync(join(SRC, file), "utf8"),
			)) {
				const isPublic =
					PUBLIC_PROCEDURES.has(`${normalized}:${proc.name}`) ||
					PUBLIC_PROCEDURES.has(`${normalized}:*`);
				if (!isPublic && !proc.tagged)
					untagged.push(`${normalized}:${proc.name}`);
			}
		}
		expect(untagged).toEqual([]);
	});

	test("every router using AuthMiddleware also uses AccessMiddleware", () => {
		const missing = files.filter((file) => {
			const source = readFileSync(join(SRC, file), "utf8");
			return (
				source.includes("AuthMiddleware") &&
				!source.includes("AccessMiddleware")
			);
		});
		expect(missing).toEqual([]);
	});
});
