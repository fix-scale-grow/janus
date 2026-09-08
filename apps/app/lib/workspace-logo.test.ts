import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLogo, removeLogo, saveLogo } from "./workspace-logo";

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
