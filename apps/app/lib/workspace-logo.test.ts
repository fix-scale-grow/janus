import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	isSvgSafe,
	matchesDeclaredType,
	readLogo,
	removeLogo,
	saveLogo,
} from "./workspace-logo";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "workspace-logo-"));
	process.env.WORKSPACE_DATA_DIR = dir;
});

afterEach(async () => {
	delete process.env.WORKSPACE_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe("workspace-logo", () => {
	it("saves a logo and reads it back with the matching content type", async () => {
		const bytes = Buffer.from("fake-png-bytes");

		const url = await saveLogo("png", bytes);
		expect(url).toMatch(/^\/api\/workspace\/logo\/file\?v=\d+$/);

		const logo = await readLogo();
		expect(logo).not.toBeNull();
		expect(logo?.contentType).toBe("image/png");
		expect(logo?.bytes.equals(bytes)).toBe(true);

		const onDisk = await readFile(join(dir, "logo.png"));
		expect(onDisk.equals(bytes)).toBe(true);
	});

	it("returns null when no logo has been saved", async () => {
		expect(await readLogo()).toBeNull();
	});

	it("replaces a previously saved logo, even across extensions", async () => {
		await saveLogo("png", Buffer.from("first"));
		await saveLogo("svg", Buffer.from("<svg></svg>"));

		const logo = await readLogo();
		expect(logo?.contentType).toBe("image/svg+xml");
		expect(logo?.bytes.toString()).toBe("<svg></svg>");

		let pngStillThere = true;
		try {
			await readFile(join(dir, "logo.png"));
		} catch {
			pngStillThere = false;
		}
		expect(pngStillThere).toBe(false);
	});

	it("removes a saved logo", async () => {
		await saveLogo("webp", Buffer.from("webp-bytes"));
		expect(await readLogo()).not.toBeNull();

		await removeLogo();
		expect(await readLogo()).toBeNull();
	});

	it("removing when nothing exists does not throw", async () => {
		await removeLogo();
	});
});

describe("matchesDeclaredType", () => {
	it("accepts real PNG magic bytes declared as PNG", () => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		expect(matchesDeclaredType("image/png", png)).toBe(true);
	});

	it("rejects a PNG file declared as SVG", () => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		expect(matchesDeclaredType("image/svg+xml", png)).toBe(false);
	});

	it("accepts real JPEG magic bytes declared as JPEG", () => {
		const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
		expect(matchesDeclaredType("image/jpeg", jpeg)).toBe(true);
	});

	it("accepts a real WebP RIFF header declared as WebP", () => {
		const webp = Buffer.concat([
			Buffer.from("RIFF", "ascii"),
			Buffer.from([0, 0, 0, 0]),
			Buffer.from("WEBP", "ascii"),
		]);
		expect(matchesDeclaredType("image/webp", webp)).toBe(true);
	});

	it("accepts a real SVG document declared as SVG", () => {
		const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
		expect(matchesDeclaredType("image/svg+xml", svg)).toBe(true);
	});

	it("rejects an SVG-labeled upload whose bytes are not SVG or XML", () => {
		const notSvg = Buffer.from("not an svg document");
		expect(matchesDeclaredType("image/svg+xml", notSvg)).toBe(false);
	});
});

describe("isSvgSafe", () => {
	it("allows a plain SVG with no scripting", () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
		);
		expect(isSvgSafe(svg)).toBe(true);
	});

	it("rejects an SVG containing a <script> element", () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
		);
		expect(isSvgSafe(svg)).toBe(false);
	});

	it("rejects an SVG with an on* event handler attribute", () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
		);
		expect(isSvgSafe(svg)).toBe(false);
	});

	it("rejects an SVG containing a foreignObject element", () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject></svg>',
		);
		expect(isSvgSafe(svg)).toBe(false);
	});

	it("rejects an SVG with an external href reference", () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
		);
		expect(isSvgSafe(svg)).toBe(false);
	});

	it("rejects an SVG with a javascript: xlink:href reference", () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)"><rect width="1" height="1"/></a></svg>',
		);
		expect(isSvgSafe(svg)).toBe(false);
	});
});
