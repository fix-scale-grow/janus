import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PHOTO_ID_PATTERN,
	photoUrl,
	readPhotoFile,
	removePhotoFiles,
	savePhotoFiles,
} from "./photo-files";

const PHOTO_ID = "clphotoaaaaaaaaaaaaaaa";

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "photo-files-"));
	process.env.PHOTOS_DATA_DIR = dir;
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
	delete process.env.PHOTOS_DATA_DIR;
});

describe("savePhotoFiles", () => {
	it("writes master and thumb and leaves no temp files", async () => {
		const saved = await savePhotoFiles(
			PHOTO_ID,
			Buffer.from("master-bytes"),
			Buffer.from("thumb-bytes"),
		);
		expect(saved).toBe(true);
		const entries = await readdir(join(dir, PHOTO_ID));
		expect(entries.sort()).toEqual(["master.jpg", "thumb.jpg"]);
	});
});

describe("readPhotoFile", () => {
	it("round-trips bytes and returns null when missing", async () => {
		await savePhotoFiles(PHOTO_ID, Buffer.from("m"), Buffer.from("t"));
		const master = await readPhotoFile(PHOTO_ID, "master");
		expect(master?.toString()).toBe("m");
		expect(await readPhotoFile("clmissingaaaaaaaaaaaaa", "thumb")).toBeNull();
	});
});

describe("removePhotoFiles", () => {
	it("removes the photo directory and tolerates a missing one", async () => {
		await savePhotoFiles(PHOTO_ID, Buffer.from("m"), Buffer.from("t"));
		await removePhotoFiles(PHOTO_ID);
		expect(await readdir(dir)).toEqual([]);
		await removePhotoFiles(PHOTO_ID);
	});
});

describe("PHOTO_ID_PATTERN", () => {
	it("accepts cuids and rejects traversal", () => {
		expect(PHOTO_ID_PATTERN.test(PHOTO_ID)).toBe(true);
		expect(PHOTO_ID_PATTERN.test("../etc/passwd")).toBe(false);
		expect(PHOTO_ID_PATTERN.test("UPPER")).toBe(false);
		expect(PHOTO_ID_PATTERN.test("short")).toBe(false);
	});
});

describe("photoUrl", () => {
	it("builds the serving path", () => {
		expect(photoUrl(PHOTO_ID, "thumb")).toBe(`/api/photos/${PHOTO_ID}/thumb`);
	});
});
